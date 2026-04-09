import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { promises as fs, Dirent } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThan, Repository } from "typeorm";

import { ItemsService } from "../items/items.service";
import { LocationsService } from "../locations/locations.service";
import { Location } from "../locations/entities/location.entity";
import { StockService } from "../stock/stock.service";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { Branch } from "../branches/entities/branch.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { Item } from "../items/entities/item.entity";
import { EmailService } from "../email/email.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { LoggingService } from "../logging/services/logging.service";
import { LogCategory } from "../logging/entities/system-log.entity";
import { PurchaseOrder, PurchaseOrderStatus } from "./entities/purchase-order.entity";
import { PurchaseOrderLine } from "./entities/purchase-order-line.entity";

type PurchaseOrderSortField = "createdAt" | "orderedAt" | "supplier";
type SortDirection = "ASC" | "DESC";

interface PurchaseOrderQueryParams {
  status?: PurchaseOrderStatus;
  year?: number;
  supplierId?: string;
  sortBy?: PurchaseOrderSortField;
  sortDir?: SortDirection;
}

interface OrderDocumentQueryParams {
  year?: number;
  supplierId?: string;
}

export interface StoredOrderDocumentEntry {
  year: number;
  month: number;
  filename: string;
  path: string;
  size: number;
  created: string;
  supplierId: string | null;
  supplierName: string | null;
  branchFolder: string | null;
}

@Injectable()
export class PurchasingService {
  // 10-Sekunden-Cache für Bestellvorschläge (kurz, damit Artikel-Änderungen schnell sichtbar sind)
  // Schlüssel: branchId oder "ALL" für SUPER_ADMIN
  private suggestionsCacheMap = new Map<string, { data: unknown[]; timestamp: number }>();
  private readonly SUGGESTIONS_CACHE_TTL = 10_000;

  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly ordersRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderLine)
    private readonly linesRepository: Repository<PurchaseOrderLine>,
    @InjectRepository(StockLevel)
    private readonly stockLevelsRepository: Repository<StockLevel>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(Item)
    private readonly itemsRepository: Repository<Item>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    private readonly itemsService: ItemsService,
    private readonly locationsService: LocationsService,
    private readonly stockService: StockService,
    private readonly emailService: EmailService,
    private readonly systemConfigService: SystemConfigService,
    private readonly loggingService: LoggingService,
  ) {}

  /** Cache für Bestellvorschläge invalidieren (nach Bestandsbuchungen, Bestellungen) */
  invalidateSuggestionsCache() {
    this.suggestionsCacheMap.clear();
  }

  async findAll(params?: PurchaseOrderQueryParams & { branchId?: string | null }) {
    const sortBy = params?.sortBy ?? "createdAt";
    const sortDir = params?.sortDir === "ASC" ? "ASC" : "DESC";

    const qb = this.ordersRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.supplier", "supplier")
      .leftJoinAndSelect("order.lines", "line")
      .leftJoinAndSelect("line.item", "item");

    if (params?.branchId) {
      qb.andWhere("order.branchId = :branchId", { branchId: params.branchId });
    }

    if (params?.status) {
      qb.andWhere("order.status = :status", { status: params.status });
    }

    if (params?.supplierId) {
      qb.andWhere("supplier.id = :supplierId", { supplierId: params.supplierId });
    }

    if (params?.year) {
      qb.andWhere("YEAR(COALESCE(order.orderedAt, order.createdAt)) = :year", { year: params.year });
    }

    switch (sortBy) {
      case "supplier":
        qb.orderBy("supplier.name", sortDir);
        qb.addOrderBy("order.createdAt", "DESC");
        break;
      case "orderedAt":
        qb.orderBy("order.orderedAt IS NULL", "ASC");
        qb.addOrderBy("order.orderedAt", sortDir);
        qb.addOrderBy("order.createdAt", "DESC");
        break;
      case "createdAt":
      default:
        qb.orderBy("order.createdAt", sortDir);
        break;
    }

    return qb.getMany();
  }

  async findOne(id: string, branchId?: string | null) {
    const where: Record<string, unknown> = { id };
    if (branchId) where.branchId = branchId;
    const order = await this.ordersRepository.findOne({ where });
    if (!order) {
      throw new NotFoundException("Purchase order not found");
    }
    return order;
  }

  async create(payload: {
    supplierId: string;
    orderNumber?: string;
    note?: string;
    lines: Array<{ itemId: string; quantity: number; packSize?: number }>;
    branchId?: string | null;
  }) {
    const supplier = await this.supplierRepository.findOne({ where: { id: payload.supplierId } });
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }

    if (!payload.lines || payload.lines.length === 0) {
      throw new BadRequestException("Purchase order needs at least one line");
    }

    const lines: PurchaseOrderLine[] = [];
    for (const line of payload.lines) {
      const item = await this.itemsService.findOne(line.itemId);
      if (!item) {
        throw new NotFoundException("Item not found");
      }
      lines.push(
        this.linesRepository.create({
          item,
          quantity: line.quantity,
          receivedQuantity: 0,
          packSize: line.packSize ?? null,
        }),
      );
    }

    const orderNumber = payload.orderNumber?.trim() || null;
    if (orderNumber) {
      await this.assertOrderNumberUnique(orderNumber);
    }

    const order = this.ordersRepository.create({
      supplier,
      status: "DRAFT",
      orderNumber: orderNumber ?? null,
      orderedAt: null,
      receivedAt: null,
      note: payload.note?.trim() || null,
      lines,
      branchId: payload.branchId ?? null,
    });

    const saved = await this.ordersRepository.save(order);

    // Generiere Bestellnummer nach dem Speichern, wenn nicht vorhanden
    if (!saved.orderNumber) {
      saved.orderNumber = await this.generateOrderNumber(saved);
      await this.ordersRepository.save(saved);
    }

    this.invalidateSuggestionsCache();
    return saved;
  }

  async update(id: string, payload: { status?: PurchaseOrderStatus; orderNumber?: string; note?: string }, branchId?: string | null) {
    const order = await this.findOne(id, branchId);
    const oldStatus = order.status;

    if (payload.status) {
      order.status = payload.status;
      if (payload.status === "ORDERED" && !order.orderedAt) {
        order.orderedAt = new Date();
      }
      if (payload.status === "CANCELLED") {
        order.receivedAt = null;
      }
      
      // Log: Status-Änderung
      if (oldStatus !== payload.status) {
        await this.loggingService.logInfo(
          LogCategory.PURCHASE,
          'purchase_order_status_changed',
          `Bestellung ${order.orderNumber || order.id} Status geändert: ${oldStatus} → ${payload.status}`,
          {
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              supplierId: order.supplier?.id,
              supplierName: order.supplier?.name,
              oldStatus: oldStatus,
              newStatus: payload.status,
              lineCount: order.lines?.length || 0,
            }
          }
        );
      }
    }

    if (payload.orderNumber !== undefined) {
      const nextNumber = payload.orderNumber?.trim() || null;
      if (nextNumber) {
        await this.assertOrderNumberUnique(nextNumber, order.id);
      }
      order.orderNumber = nextNumber;
    }
    if (payload.note !== undefined) {
      order.note = payload.note?.trim() || null;
    }

    if (!order.orderNumber && order.status === "ORDERED") {
      order.orderNumber = await this.generateOrderNumber(order, order.orderedAt ?? new Date());
    }

    const saved = await this.ordersRepository.save(order);
    if (payload.status === "ORDERED") {
      await this.saveOrderPdfToStorage(saved);
    }
    this.invalidateSuggestionsCache();
    return saved;
  }

  async receiveOrder(
    id: string,
    payload: { lines: Array<{ lineId: string; receivedQuantity?: number }> },
    userId?: string,
    branchId?: string | null,
  ) {
    const order = await this.findOne(id, branchId);
    if (order.status === "CANCELLED" || order.status === "ARCHIVED") {
      throw new BadRequestException("Cancelled orders cannot be received");
    }

    const warehouseLocations = await this.locationsService.findAll({ type: "WAREHOUSE", includeVehicles: true });
    const defaultWarehouse = warehouseLocations[0] ?? null;
    let hasAnyBookedQuantity = false;

    for (const linePayload of payload.lines) {
      const line = order.lines.find((entry) => entry.id === linePayload.lineId);
      if (!line) {
        throw new NotFoundException("Order line not found");
      }

      const remaining = line.quantity - line.receivedQuantity;
      if (remaining <= 0) {
        continue;
      }

      const toReceive = linePayload.receivedQuantity ?? remaining;
      if (toReceive <= 0) {
        continue;
      }

      hasAnyBookedQuantity = true;
      line.receivedQuantity = Math.min(line.quantity, line.receivedQuantity + toReceive);

      const item = await this.itemsService.findOne(line.item.id);
      const locationId = item?.storageLocation?.id ?? defaultWarehouse?.id ?? null;
      if (!locationId) {
        throw new BadRequestException("Keine Lagerposition fuer Wareneingang hinterlegt.");
      }

      await this.stockService.recordMovement({
        itemId: line.item.id,
        locationId,
        userId,
        type: "CHECKIN",
        quantity: toReceive,
        occurredAt: new Date().toISOString(),
        note: `Wareneingang Bestellung ${order.orderNumber ?? order.id}`,
        source: `purchase-order:${order.id}`,
      });
    }

    if (!hasAnyBookedQuantity) {
      throw new BadRequestException("Keine gueltigen Mengen fuer den Wareneingang uebergeben.");
    }

    const allReceived = order.lines.every((line) => line.receivedQuantity >= line.quantity);
    if (allReceived) {
      order.status = "ARCHIVED";
      order.receivedAt = new Date();
      if (!order.orderedAt) {
        order.orderedAt = new Date();
      }
    } else {
      order.status = "ORDERED";
      order.receivedAt = null;
      if (!order.orderedAt) {
        order.orderedAt = new Date();
      }
    }

    const savedOrder = await this.ordersRepository.save(order);
    this.invalidateSuggestionsCache();
    return savedOrder;
  }

  async remove(id: string, branchId?: string | null): Promise<void> {
    const order = await this.findOne(id, branchId);
    await this.ordersRepository.remove(order);
    this.invalidateSuggestionsCache();
  }

  async previewPurgeOldOrders(years = 10, branchId?: string | null): Promise<{ count: number; oldestDate: string | null; cutoffDate: string }> {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);

    const qb = this.ordersRepository
      .createQueryBuilder("order")
      .where("order.status IN (:...statuses)", { statuses: ["RECEIVED", "ARCHIVED", "CANCELLED"] })
      .andWhere("COALESCE(order.orderedAt, order.createdAt) < :cutoff", { cutoff })
      .orderBy("COALESCE(order.orderedAt, order.createdAt)", "ASC");
    if (branchId) qb.andWhere("order.branchId = :branchId", { branchId });
    const orders = await qb.getMany();

    const oldest = orders.length > 0
      ? (orders[0].orderedAt ?? orders[0].createdAt ?? null)
      : null;

    return {
      count: orders.length,
      oldestDate: oldest ? new Date(oldest).toISOString() : null,
      cutoffDate: cutoff.toISOString(),
    };
  }

  async purgeOldOrders(years = 10, branchId?: string | null): Promise<{ deleted: number }> {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);

    const qb = this.ordersRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.lines", "line")
      .where("order.status IN (:...statuses)", { statuses: ["RECEIVED", "ARCHIVED", "CANCELLED"] })
      .andWhere("COALESCE(order.orderedAt, order.createdAt) < :cutoff", { cutoff });
    if (branchId) qb.andWhere("order.branchId = :branchId", { branchId });
    const orders = await qb.getMany();

    if (orders.length === 0) return { deleted: 0 };

    // PDFs vom Dateisystem löschen
    const storagePath = this.getPurchaseOrderStoragePath();
    for (const order of orders) {
      try {
        const year = this.getOrderDocumentYear(order);
        const filename = this.buildStoredOrderFilename(order);
        const fullPath = path.join(storagePath, year, filename);
        await fs.unlink(fullPath);
      } catch {
        // Datei existiert nicht – ok
      }
    }

    await this.ordersRepository.remove(orders);
    this.invalidateSuggestionsCache();

    await this.loggingService.logInfo(
      LogCategory.PURCHASE,
      'purchase_orders_purged',
      `Bestellarchiv bereinigt: ${orders.length} Bestellungen älter als ${years} Jahre gelöscht`,
      { metadata: { deletedCount: orders.length, years, cutoffDate: cutoff.toISOString() } },
    );

    return { deleted: orders.length };
  }

  async getOrderPdf(id: string, branchId?: string | null): Promise<{ filename: string; buffer: Buffer }> {
    const order = await this.findOne(id, branchId);
    const buffer = await this.buildOrderPdf(order);
    await this.saveOrderPdfToStorage(order, buffer);
    const safeNumber = (order.orderNumber || order.id).replace(/[^a-zA-Z0-9_-]/g, "_");
    return { filename: `${safeNumber}.pdf`, buffer };
  }

  async sendOrderEmail(
    id: string,
    payload?: { to?: string; subject?: string; message?: string },
    branchId?: string | null,
  ): Promise<void> {
    const order = await this.findOne(id, branchId);
    const recipient = payload?.to?.trim() || order.supplier?.email;
    
    // Log: E-Mail-Versand gestartet
    await this.loggingService.logInfo(
      LogCategory.EMAIL,
      'purchase_order_email_start',
      `E-Mail-Versand für Bestellung ${order.orderNumber || order.id} gestartet`,
      {
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          supplierId: order.supplier?.id,
          supplierName: order.supplier?.name,
          recipient: recipient,
          lineCount: order.lines?.length || 0,
        }
      }
    );
    
    if (!recipient) {
      await this.loggingService.logError(
        LogCategory.EMAIL,
        'purchase_order_email_failed',
        `E-Mail-Versand fehlgeschlagen: Kein Empfänger für Bestellung ${order.orderNumber || order.id}`,
        {
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            supplierId: order.supplier?.id,
            supplierName: order.supplier?.name,
            error: 'Keine E-Mail-Adresse hinterlegt',
          }
        }
      );
      throw new BadRequestException("Kein Empfaenger fuer die Bestellung hinterlegt.");
    }

    try {
      const { filename, buffer } = await this.getOrderPdf(id);
      
      // Lade E-Mail-Vorlage aus System-Config
      const emailTemplate = await this.systemConfigService.getPurchaseOrderEmailTemplate();
      const companyConfig = await this.systemConfigService.getCompanyConfig(branchId);
      
      // Ersetze Platzhalter in Vorlage
      const replacePlaceholders = (text: string): string => {
        return text
          .replace(/\{\{orderNumber\}\}/g, order.orderNumber || order.id)
          .replace(/\{\{supplierName\}\}/g, order.supplier?.name || '')
          .replace(/\{\{companyName\}\}/g, companyConfig.name || '')
          .replace(/\{\{companyEmail\}\}/g, companyConfig.email || '')
          .replace(/\{\{companyPhone\}\}/g, companyConfig.phone || '')
          .replace(/\{\{userName\}\}/g, '');
      };
      
      const subject = payload?.subject?.trim() || replacePlaceholders(emailTemplate.subject);
      const message = payload?.message?.trim() || replacePlaceholders(emailTemplate.body);

      await this.emailService.sendEmail({
        to: recipient,
        subject,
        text: message,
        attachments: [
          {
            filename,
            content: buffer,
            contentType: "application/pdf",
          },
        ],
      });
      
      // Log: E-Mail erfolgreich versendet
      await this.loggingService.logInfo(
        LogCategory.EMAIL,
        'purchase_order_email_sent',
        `Bestellung ${order.orderNumber || order.id} erfolgreich per E-Mail versendet`,
        {
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            supplierId: order.supplier?.id,
            supplierName: order.supplier?.name,
            recipient: recipient,
            subject: subject,
            pdfFilename: filename,
            lineCount: order.lines?.length || 0,
          }
        }
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // Log: E-Mail-Versand fehlgeschlagen
      await this.loggingService.logError(
        LogCategory.EMAIL,
        'purchase_order_email_failed',
        `E-Mail-Versand für Bestellung ${order.orderNumber || order.id} fehlgeschlagen: ${err.message}`,
        {
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            supplierId: order.supplier?.id,
            supplierName: order.supplier?.name,
            recipient: recipient,
            error: err.message,
            errorStack: err.stack,
            lineCount: order.lines?.length || 0,
          }
        }
      );
      throw err;
    }
  }

  async getSuggestions(branchId: string | null | undefined, refresh = false) {
    // Cache-Check pro Niederlassung (überspringen wenn refresh=true)
    const cacheKey = branchId ?? "ALL";
    const now = Date.now();
    const cached = this.suggestionsCacheMap.get(cacheKey);
    if (!refresh && cached && (now - cached.timestamp) < this.SUGGESTIONS_CACHE_TTL) {
      return cached.data;
    }

    // Offene Bestellmengen (nur Bestellungen dieser Niederlassung berücksichtigen)
    const openLinesQb = this.linesRepository
      .createQueryBuilder("line")
      .innerJoin("line.order", "order")
      .innerJoin("line.item", "item")
      .select("item.id", "itemId")
      .addSelect("SUM(line.quantity - line.receivedQuantity)", "openQuantity")
      .where("order.status IN (:...statuses)", { statuses: ["DRAFT", "ORDERED"] })
      .andWhere("line.quantity > line.receivedQuantity");

    if (branchId) {
      openLinesQb.andWhere("order.branchId = :branchId", { branchId });
    }

    const openLines = await openLinesQb.groupBy("item.id").getRawMany();

    const incomingByItem = new Map<string, number>();
    openLines.forEach((row) => {
      const qty = Number(row.openQuantity ?? 0);
      if (!Number.isNaN(qty)) {
        incomingByItem.set(row.itemId, qty);
      }
    });

    // Nur Artikel dieser Niederlassung laden
    const itemEntities = await this.itemsRepository.find({
      where: { targetStock: MoreThan(0), ...(branchId ? { branchId } : {}) },
      relations: ["storageLocation", "supplier"],
    });
    const allLocations = await this.locationsService.findAll({ includeVehicles: true, branchId: branchId ?? undefined });
    const defaultWarehouse = allLocations.find((location) => location.type === "WAREHOUSE") ?? null;
    const locationById = new Map<string, Location>();
    allLocations.forEach((location) => {
      locationById.set(location.id, location);
    });

    const itemIds = itemEntities.map((item) => item.id);
    const stockLevels = itemIds.length
      ? await this.stockLevelsRepository.find({
          where: { item: { id: In(itemIds) } },
          relations: ["location"],
        })
      : [];
    const stockLevelsByItem = new Map<string, StockLevel[]>();
    stockLevels.forEach((level) => {
      const itemId = level.item?.id;
      if (!itemId) return;
      const existing = stockLevelsByItem.get(itemId);
      if (existing) {
        existing.push(level);
      } else {
        stockLevelsByItem.set(itemId, [level]);
      }
    });

    const suggestions: Array<{
      itemId: string;
      code: string;
      description: string;
      descriptionSecondary: string | null;
      supplierId: string | null;
      supplierName: string | null;
      storageLocationId: string | null;
      targetStock: number;
      minimumStock: number | null;
      reorderPoint: number | null;
      currentQuantity: number;
      neededQuantity: number;
      availableInOtherBranches: Array<{ branchId: string; branchName: string; quantity: number }>;
    }> = [];

    for (const item of itemEntities) {
      const target = Number(item.targetStock ?? 0);
      const itemStockLevels = stockLevelsByItem.get(item.id) ?? [];
      const locationId = this.resolveSuggestionLocationId(
        item.storageLocation ?? null,
        itemStockLevels,
        locationById,
        defaultWarehouse?.id ?? null,
      );
      if (!locationId) continue;

      const level = itemStockLevels.find((entry) => entry.location?.id === locationId);
      const legacyUnassignedLevel = itemStockLevels.find(
        (entry) => !entry.location?.id && !entry.vehicle?.id,
      );
      const currentQuantity = Number(level?.quantity ?? legacyUnassignedLevel?.quantity ?? 0);
      const incomingQuantity = incomingByItem.get(item.id) ?? 0;

      // Meldebestand-Logik: Bestellung auslösen wenn Bestand <= Meldebestand (falls gesetzt),
      // sonst klassisch wenn Bestand < Sollbestand
      const reorderPoint = item.reorderPoint != null ? Number(item.reorderPoint) : null;
      const triggerOrder =
        reorderPoint != null
          ? currentQuantity + incomingQuantity <= reorderPoint
          : currentQuantity + incomingQuantity < target;
      if (!triggerOrder) continue;

      const needed = Math.max(0, target - currentQuantity - incomingQuantity);
      if (needed <= 0) continue;

      suggestions.push({
        itemId: item.id,
        code: item.code,
        description: item.description,
        descriptionSecondary: item.descriptionSecondary ?? null,
        supplierId: item.supplier?.id ?? null,
        supplierName: item.supplier?.name ?? null,
        storageLocationId: locationId,
        targetStock: target,
        minimumStock: item.minimumStock != null ? Number(item.minimumStock) : null,
        reorderPoint,
        currentQuantity,
        neededQuantity: needed,
        availableInOtherBranches: [],
      });
    }

    // Cross-Branch-Verfügbarkeit nachladen (nur wenn Benutzer einer Niederlassung angehört)
    if (branchId && suggestions.length > 0) {
      const codes = suggestions.map((s) => s.code);
      const crossBranchMap = await this.getCrossBranchAvailability(codes, branchId);
      for (const suggestion of suggestions) {
        suggestion.availableInOtherBranches = crossBranchMap.get(suggestion.code) ?? [];
      }
    }

    // Ergebnis cachen
    this.suggestionsCacheMap.set(cacheKey, { data: suggestions, timestamp: Date.now() });
    return suggestions;
  }

  private resolveSuggestionLocationId(
    storageLocation: Location | null | undefined,
    itemStockLevels: StockLevel[],
    locationById: Map<string, Location>,
    defaultWarehouseId: string | null,
  ): string | null {
    const explicitLocation = storageLocation
      ? (locationById.get(storageLocation.id) ?? storageLocation)
      : null;

    if (explicitLocation && explicitLocation.type !== "WAREHOUSE") {
      return explicitLocation.id;
    }

    const stockLocationId = this.pickBestStockLocationId(
      itemStockLevels,
      locationById,
      explicitLocation?.id ?? null,
    );
    if (stockLocationId) {
      return stockLocationId;
    }

    return explicitLocation?.id ?? defaultWarehouseId;
  }

  private pickBestStockLocationId(
    itemStockLevels: StockLevel[],
    locationById: Map<string, Location>,
    rootLocationId: string | null,
  ): string | null {
    const candidates = itemStockLevels
      .map((level) => {
        const locationId = level.location?.id ?? null;
        if (!locationId) return null;
        const location = locationById.get(locationId) ?? level.location ?? null;
        if (!location || location.type === "VEHICLE") return null;
        if (rootLocationId && !this.isDescendantLocation(location.id, rootLocationId, locationById)) {
          return null;
        }
        return {
          locationId: location.id,
          quantity: Number(level.quantity ?? 0),
          depth: this.getLocationDepth(location.id, locationById),
        };
      })
      .filter((entry): entry is { locationId: string; quantity: number; depth: number } => Boolean(entry));

    if (candidates.length === 0) return null;

    const withStock = candidates.filter((entry) => entry.quantity > 0);
    const pool = withStock.length > 0 ? withStock : candidates;
    pool.sort((a, b) => {
      const depthDiff = b.depth - a.depth;
      if (depthDiff !== 0) return depthDiff;
      return b.quantity - a.quantity;
    });

    return pool[0]?.locationId ?? null;
  }

  private isDescendantLocation(
    candidateLocationId: string,
    parentLocationId: string,
    locationById: Map<string, Location>,
  ): boolean {
    if (candidateLocationId === parentLocationId) {
      return true;
    }

    const seen = new Set<string>();
    let current = locationById.get(candidateLocationId) ?? null;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      const currentParentId = current.parent?.id ?? null;
      if (!currentParentId) return false;
      if (currentParentId === parentLocationId) return true;
      current = locationById.get(currentParentId) ?? current.parent ?? null;
    }

    return false;
  }

  private getLocationDepth(locationId: string, locationById: Map<string, Location>): number {
    const seen = new Set<string>();
    let current = locationById.get(locationId) ?? null;
    let depth = 0;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      depth += 1;
      const parentId = current.parent?.id ?? null;
      current = parentId ? (locationById.get(parentId) ?? current.parent ?? null) : null;
    }
    return depth;
  }

  /** Findet Artikel-Bestände (Lager, keine Fahrzeuge) in ANDEREN Niederlassungen anhand des Artikel-Codes. */
  private async getCrossBranchAvailability(
    codes: string[],
    currentBranchId: string,
  ): Promise<Map<string, Array<{ branchId: string; branchName: string; quantity: number }>>> {
    const result = new Map<string, Array<{ branchId: string; branchName: string; quantity: number }>>();
    if (codes.length === 0) return result;

    const rows = await this.itemsRepository
      .createQueryBuilder("item")
      .innerJoin("item.branch", "branch")
      .leftJoin(
        "stock_levels",
        "sl",
        "sl.itemId = item.id AND sl.vehicleId IS NULL",
      )
      .select("item.code", "code")
      .addSelect("item.branchId", "branchId")
      .addSelect("branch.name", "branchName")
      .addSelect("COALESCE(SUM(sl.quantity), 0)", "quantity")
      .where("item.code IN (:...codes)", { codes })
      .andWhere("item.branchId != :currentBranchId", { currentBranchId })
      .andWhere("branch.active = :active", { active: true })
      .groupBy("item.code, item.branchId, branch.name")
      .having("COALESCE(SUM(sl.quantity), 0) > 0")
      .getRawMany<{ code: string; branchId: string; branchName: string; quantity: string }>();

    for (const row of rows) {
      const entry = { branchId: row.branchId, branchName: row.branchName, quantity: Number(row.quantity) };
      const existing = result.get(row.code);
      if (existing) {
        existing.push(entry);
      } else {
        result.set(row.code, [entry]);
      }
    }

    return result;
  }

  async listOrderDocuments(params?: OrderDocumentQueryParams, branchId?: string | null): Promise<StoredOrderDocumentEntry[]> {
    const storagePath = this.getPurchaseOrderStoragePath();
    try {
      await fs.access(storagePath);
    } catch {
      return [];
    }

    try {
      // Lookup-Map: relPath → Supplier-Info (sowohl neue als auch alte Pfade)
      const fileToSupplier = new Map<string, { supplierId: string | null; supplierName: string | null }>();
      const allOrders = await this.ordersRepository.find({ where: branchId ? { branchId } : undefined });
      for (const order of allOrders) {
        const filename = this.buildStoredOrderFilename(order);
        const refDate = new Date(order.orderedAt ?? order.createdAt ?? new Date());
        const year = String(refDate.getFullYear());
        const month = String(refDate.getMonth() + 1).padStart(2, '0');
        const branchFolder = await this.getBranchFolder(order.branchId);
        const entry = { supplierId: order.supplier?.id ?? null, supplierName: order.supplier?.name ?? null };
        // Neuer Pfad: branchFolder/YYYY/MM/filename.pdf
        fileToSupplier.set(`${branchFolder}/${year}/${month}/${filename}`, entry);
        // Alter Pfad (Rückwärtskompatibilität): YYYY/filename.pdf
        fileToSupplier.set(`${year}/${filename}`, entry);
      }

      const topLevelEntries = await fs.readdir(storagePath, { withFileTypes: true });
      const documents: StoredOrderDocumentEntry[] = [];

      for (const topEntry of topLevelEntries) {
        if (!topEntry.isDirectory()) continue;

        if (/^\d{4}$/.test(topEntry.name)) {
          // Alte Struktur: YYYY/filename.pdf
          const year = Number.parseInt(topEntry.name, 10);
          if (params?.year && year !== params.year) continue;
          const yearPath = path.join(storagePath, topEntry.name);
          let files: Dirent<string>[] = [];
          try { files = await fs.readdir(yearPath, { withFileTypes: true }); } catch { continue; }
          for (const file of files) {
            if (!file.isFile() || !this.isValidOrderDocumentFilename(file.name)) continue;
            const relPath = `${topEntry.name}/${file.name}`;
            const mappedSupplier = fileToSupplier.get(relPath);
            if (params?.supplierId && mappedSupplier?.supplierId !== params.supplierId) continue;
            const stats = await fs.stat(path.join(yearPath, file.name));
            documents.push({
              year, month: 0, filename: file.name, path: relPath, size: stats.size,
              created: stats.mtime.toISOString(),
              supplierId: mappedSupplier?.supplierId ?? null,
              supplierName: mappedSupplier?.supplierName ?? null,
              branchFolder: null,
            });
          }
        } else {
          // Neue Struktur: branchFolder/YYYY/MM/filename.pdf
          const branchFolderName = topEntry.name;
          const branchPath = path.join(storagePath, branchFolderName);
          let yearDirs: Dirent<string>[] = [];
          try { yearDirs = await fs.readdir(branchPath, { withFileTypes: true }); } catch { continue; }

          for (const yearDir of yearDirs) {
            if (!yearDir.isDirectory() || !/^\d{4}$/.test(yearDir.name)) continue;
            const year = Number.parseInt(yearDir.name, 10);
            if (params?.year && year !== params.year) continue;
            const yearPath = path.join(branchPath, yearDir.name);
            let monthDirs: Dirent<string>[] = [];
            try { monthDirs = await fs.readdir(yearPath, { withFileTypes: true }); } catch { continue; }

            for (const monthDir of monthDirs) {
              if (!monthDir.isDirectory() || !/^\d{2}$/.test(monthDir.name)) continue;
              const month = Number.parseInt(monthDir.name, 10);
              const monthPath = path.join(yearPath, monthDir.name);
              let files: Dirent<string>[] = [];
              try { files = await fs.readdir(monthPath, { withFileTypes: true }); } catch { continue; }

              for (const file of files) {
                if (!file.isFile() || !this.isValidOrderDocumentFilename(file.name)) continue;
                const relPath = `${branchFolderName}/${yearDir.name}/${monthDir.name}/${file.name}`;
                const mappedSupplier = fileToSupplier.get(relPath);
                if (params?.supplierId && mappedSupplier?.supplierId !== params.supplierId) continue;
                const stats = await fs.stat(path.join(monthPath, file.name));
                documents.push({
                  year, month, filename: file.name, path: relPath, size: stats.size,
                  created: stats.mtime.toISOString(),
                  supplierId: mappedSupplier?.supplierId ?? null,
                  supplierName: mappedSupplier?.supplierName ?? null,
                  branchFolder: branchFolderName,
                });
              }
            }
          }
        }
      }

      documents.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        const dateDiff = new Date(b.created).getTime() - new Date(a.created).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.filename.localeCompare(b.filename, "de", { sensitivity: "base" });
      });

      return documents;
    } catch (err) {
      console.error('[PurchasingService] listOrderDocuments Fehler:', err);
      return [];
    }
  }

  async getOrderDocument(relPath: string, branchId?: string | null): Promise<{ filename: string; buffer: Buffer }> {
    // Sicherheitscheck: Nur erlaubte Zeichen, keine Path-Traversal-Angriffe
    if (!relPath || !/^[a-zA-Z0-9._\-/]+$/.test(relPath) || relPath.includes('..') || relPath.includes('\\')) {
      throw new BadRequestException("Ungueltiger Dateipfad.");
    }

    const parts = relPath.split('/');
    const filename = parts[parts.length - 1];

    if (!this.isValidOrderDocumentFilename(filename)) {
      throw new BadRequestException("Ungueltiger Dateiname.");
    }

    // Niederlassungs-Isolation: Dateiname muss einer Bestellung der eigenen NL entsprechen
    if (branchId) {
      const branchOrders = await this.ordersRepository.find({ where: { branchId } });
      const isOwned = branchOrders.some((order) => this.buildStoredOrderFilename(order) === filename);
      if (!isOwned) {
        throw new NotFoundException("Dokument nicht gefunden.");
      }
    }

    const storagePath = this.getPurchaseOrderStoragePath();
    const fullPath = path.join(storagePath, relPath);

    // Path-Traversal-Schutz
    const resolvedBase = path.resolve(storagePath);
    const resolvedFull = path.resolve(fullPath);
    if (!resolvedFull.startsWith(resolvedBase + path.sep) && resolvedFull !== resolvedBase) {
      throw new BadRequestException("Ungueltiger Dateipfad.");
    }

    let stat;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      throw new NotFoundException("Dokument nicht gefunden.");
    }

    if (!stat.isFile()) {
      throw new NotFoundException("Dokument nicht gefunden.");
    }

    const buffer = await fs.readFile(fullPath);
    return { filename, buffer };
  }

  private async buildOrderPdf(order: PurchaseOrder): Promise<Buffer> {
    const template = await this.systemConfigService.getPurchaseOrderPdfTemplate();
    const company = await this.systemConfigService.getCompanyConfig(order.branchId);

    const orderNumber = order.orderNumber ?? order.id;
    const orderDate = order.orderedAt ?? order.createdAt;
    const orderDateLabel = orderDate ? new Date(orderDate).toLocaleDateString("de-DE") : "-";
    const statusLabels: Record<PurchaseOrderStatus, string> = {
      DRAFT: "Entwurf",
      ORDERED: "Bestellt",
      RECEIVED: "Eingegangen",
      CANCELLED: "Storniert",
      ARCHIVED: "Archiviert",
    };
    const orderStatusLabel = statusLabels[order.status] ?? order.status;

    const lines = order.lines.map((line, index) => {
      const quantity = Number(line.quantity ?? 0);
      const received = Number(line.receivedQuantity ?? 0);
      const remaining = Math.max(0, quantity - received);
      const packSize = line.packSize ?? null;

      return {
        lineIndex: String(index + 1),
        itemCode: line.item.code ?? "",
        itemDescription: line.item.description ?? "",
        quantity: String(quantity),
        receivedQuantity: String(received),
        remainingQuantity: String(remaining),
        packSize: packSize ? String(packSize) : "",
      };
    });

    const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity), 0);
    const totalReceived = lines.reduce((sum, line) => sum + Number(line.receivedQuantity), 0);
    const totalRemaining = lines.reduce((sum, line) => sum + Number(line.remainingQuantity), 0);

    const supplier = order.supplier;
    const companyCityLine = [company.postalCode, company.city].filter(Boolean).join(" ");

    const replaceConditional = (text: string, key: string, value: any) => {
      const showPattern = new RegExp(`\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, "g");
      const hidePattern = new RegExp(`\\{\\{\\^${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, "g");
      text = text.replace(showPattern, value ? "$1" : "");
      text = text.replace(hidePattern, value ? "" : "$1");
      return text;
    };

    const replaceSimple = (text: string, key: string, value: string) => {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      return text.replace(pattern, value);
    };

    const escapeHtml = (value?: string | null) => {
      if (!value) return "";
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    let html = template.html;
    html = this.stripOrderPdfFields(html);

    html = replaceConditional(html, "companyLogo", company.logoDataUrl);
    html = replaceConditional(html, "companyAddressLine1", company.addressLine1);
    html = replaceConditional(html, "companyAddressLine2", company.addressLine2);
    html = replaceConditional(html, "companyCityLine", companyCityLine);
    html = replaceConditional(html, "companyPostalCode", company.postalCode);
    html = replaceConditional(html, "companyCity", company.city);
    html = replaceConditional(html, "companyCountry", company.country);
    html = replaceConditional(html, "companyPhone", company.phone);
    html = replaceConditional(html, "companyEmail", company.email);
    html = replaceConditional(html, "note", order.note);
    html = replaceConditional(html, "supplierAddressLine1", supplier?.addressLine1);
    html = replaceConditional(html, "supplierAddressLine2", supplier?.addressLine2);
    html = replaceConditional(html, "supplierPostalCode", supplier?.postalCode);
    html = replaceConditional(html, "supplierCity", supplier?.city);
    html = replaceConditional(html, "supplierCountry", supplier?.country);
    html = replaceConditional(html, "supplierContactName", supplier?.contactName);
    html = replaceConditional(html, "supplierEmail", supplier?.email);
    html = replaceConditional(html, "supplierPhone", supplier?.phone);
    html = replaceConditional(html, "supplierCustomerNumber", supplier?.customerNumber);

    html = replaceSimple(html, "title", escapeHtml("Bestellung"));
    html = replaceSimple(html, "companyName", escapeHtml(company.name ?? "Lagerverwaltung"));
    html = replaceSimple(html, "companyLogo", company.logoDataUrl ?? "");
    html = replaceSimple(html, "companyAddressLine1", escapeHtml(company.addressLine1 ?? ""));
    html = replaceSimple(html, "companyAddressLine2", escapeHtml(company.addressLine2 ?? ""));
    html = replaceSimple(html, "companyCityLine", escapeHtml(companyCityLine));
    html = replaceSimple(html, "companyPostalCode", escapeHtml(company.postalCode ?? ""));
    html = replaceSimple(html, "companyCity", escapeHtml(company.city ?? ""));
    html = replaceSimple(html, "companyCountry", escapeHtml(company.country ?? ""));
    html = replaceSimple(html, "companyPhone", escapeHtml(company.phone ?? ""));
    html = replaceSimple(html, "companyEmail", escapeHtml(company.email ?? ""));
    html = replaceSimple(html, "orderNumber", escapeHtml(orderNumber));
    html = replaceSimple(html, "orderDate", escapeHtml(orderDateLabel));
    html = replaceSimple(html, "orderStatus", escapeHtml(orderStatusLabel));
    html = replaceSimple(html, "supplierName", escapeHtml(supplier?.name ?? "-"));
    html = replaceSimple(html, "supplierAddressLine1", escapeHtml(supplier?.addressLine1 ?? ""));
    html = replaceSimple(html, "supplierAddressLine2", escapeHtml(supplier?.addressLine2 ?? ""));
    html = replaceSimple(html, "supplierPostalCode", escapeHtml(supplier?.postalCode ?? ""));
    html = replaceSimple(html, "supplierCity", escapeHtml(supplier?.city ?? ""));
    html = replaceSimple(html, "supplierCountry", escapeHtml(supplier?.country ?? ""));
    html = replaceSimple(html, "supplierContactName", escapeHtml(supplier?.contactName ?? ""));
    html = replaceSimple(html, "supplierEmail", escapeHtml(supplier?.email ?? ""));
    html = replaceSimple(html, "supplierPhone", escapeHtml(supplier?.phone ?? ""));
    html = replaceSimple(html, "supplierCustomerNumber", escapeHtml(supplier?.customerNumber ?? ""));
    html = replaceSimple(html, "note", escapeHtml(order.note ?? ""));
    html = replaceSimple(html, "totalQuantity", escapeHtml(String(totalQuantity)));
    html = replaceSimple(html, "totalReceived", escapeHtml(String(totalReceived)));
    html = replaceSimple(html, "totalRemaining", escapeHtml(String(totalRemaining)));

    const linesMatch = html.match(/\{\{#lines\}\}([\s\S]*?)\{\{\/lines\}\}/);
    if (linesMatch) {
      const rowTemplate = linesMatch[1];
      let rowsHtml = "";

      for (const line of lines) {
        let rowHtml = rowTemplate;
        rowHtml = replaceConditional(rowHtml, "packSize", line.packSize);

        rowHtml = replaceSimple(rowHtml, "lineIndex", escapeHtml(line.lineIndex));
        rowHtml = replaceSimple(rowHtml, "itemCode", escapeHtml(line.itemCode));
        rowHtml = replaceSimple(rowHtml, "itemDescription", escapeHtml(line.itemDescription));
        rowHtml = replaceSimple(rowHtml, "quantity", escapeHtml(line.quantity));
        rowHtml = replaceSimple(rowHtml, "receivedQuantity", escapeHtml(line.receivedQuantity));
        rowHtml = replaceSimple(rowHtml, "remainingQuantity", escapeHtml(line.remainingQuantity));
        rowHtml = replaceSimple(rowHtml, "packSize", escapeHtml(line.packSize));
        rowsHtml += rowHtml;
      }

      html = html.replace(/\{\{#lines\}\}[\s\S]*?\{\{\/lines\}\}/g, rowsHtml);
    }

    const posColumnFixCss = `
.lines-table th,
.items-table th {
  text-align: left;
}

.lines-table th:first-child,
.lines-table td:first-child,
.items-table th:first-child,
.items-table td:first-child {
  text-align: left !important;
  padding-left: 10px !important;
  min-width: 44px;
}

.lines-table th:nth-child(2),
.lines-table td:nth-child(2),
.lines-table th:nth-child(3),
.lines-table td:nth-child(3),
.items-table th:nth-child(2),
.items-table td:nth-child(2),
.items-table th:nth-child(3),
.items-table td:nth-child(3) {
  text-align: left !important;
  padding-left: 8px !important;
}
`;

    const fullHtml = html.replace(
      "</head>",
      `<style>${template.css}</style><style>${posColumnFixCss}</style></head>`,
    );
    const escapeFooterHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const footerCompanyText = [
      company.name?.trim() || "Lagerverwaltung",
      company.phone ? `Tel: ${company.phone}` : "",
      company.email ? `E-Mail: ${company.email}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const footerTemplate = `
<div style="width:100%;padding:0 18px;font-size:8px;color:#555;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;">
  <div>${escapeFooterHtml(footerCompanyText)}</div>
  <div>Seite <span class="pageNumber"></span> / <span class="totalPages"></span></div>
</div>`;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate,
        margin: {
          top: "0px",
          right: "0px",
          bottom: "42px",
          left: "0px",
        },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private stripOrderPdfFields(html: string): string {
    let sanitized = html;

    // Remove status line/block from metadata area.
    sanitized = sanitized.replace(/\{\{#orderStatus\}\}[\s\S]*?\{\{\/orderStatus\}\}/gi, "");
    sanitized = sanitized.replace(/\{\{\^orderStatus\}\}[\s\S]*?\{\{\/orderStatus\}\}/gi, "");
    sanitized = sanitized.replace(
      /<[^>]+>\s*(?:Status|Bestellstatus)\s*:?\s*\{\{orderStatus\}\}\s*<\/[^>]+>/gi,
      "",
    );
    sanitized = sanitized.replace(/\{\{orderStatus\}\}/g, "");

    // Legacy cleanup: remove old price/total columns and placeholders from historic templates.
    sanitized = sanitized.replace(
      /<th\b[^>]*>(?:(?!<\/th>)[\s\S])*?(?:Preis|Price|\{\{[^}]*unitPrice[^}]*\}\})(?:(?!<\/th>)[\s\S])*?<\/th>/gi,
      "",
    );
    sanitized = sanitized.replace(
      /<th\b[^>]*>(?:(?!<\/th>)[\s\S])*?(?:Gesamt|Total|\{\{[^}]*lineTotal[^}]*\}\})(?:(?!<\/th>)[\s\S])*?<\/th>/gi,
      "",
    );
    sanitized = sanitized.replace(
      /<td\b[^>]*>(?:(?!<\/td>)[\s\S])*?(?:\{\{[^}]*unitPrice[^}]*\}|unitPrice)(?:(?!<\/td>)[\s\S])*?<\/td>/gi,
      "",
    );
    sanitized = sanitized.replace(
      /<td\b[^>]*>(?:(?!<\/td>)[\s\S])*?(?:\{\{[^}]*lineTotal[^}]*\}|lineTotal)(?:(?!<\/td>)[\s\S])*?<\/td>/gi,
      "",
    );

    sanitized = sanitized.replace(/\{\{#unitPrice\}\}[\s\S]*?\{\{\/unitPrice\}\}/gi, "");
    sanitized = sanitized.replace(/\{\{\^unitPrice\}\}[\s\S]*?\{\{\/unitPrice\}\}/gi, "");
    sanitized = sanitized.replace(/\{\{#lineTotal\}\}[\s\S]*?\{\{\/lineTotal\}\}/gi, "");
    sanitized = sanitized.replace(/\{\{\^lineTotal\}\}[\s\S]*?\{\{\/lineTotal\}\}/gi, "");
    sanitized = sanitized.replace(/\{\{unitPrice\}\}/g, "");
    sanitized = sanitized.replace(/\{\{lineTotal\}\}/g, "");

    sanitized = sanitized.replace(
      /<(div|p|span)\b[^>]*>[\s\S]*?\{\{totalValue\}\}[\s\S]*?<\/\1>/gi,
      "",
    );
    sanitized = sanitized.replace(/\{\{totalValue\}\}/g, "");

    // Safety net for malformed old templates (e.g. literal {{#unitPrice}} appearing in output).
    sanitized = sanitized.replace(/\{\{\s*[#\/\^]?\s*(unitPrice|lineTotal|totalValue)\s*\}\}/gi, "");

    return sanitized;
  }

  private async assertOrderNumberUnique(orderNumber: string, excludeId?: string) {
    const existing = await this.ordersRepository.findOne({ where: { orderNumber } });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException("Bestellnummer existiert bereits.");
    }
  }

  private extractNamePrefix(name: string | null | undefined, fallback: string, length = 5): string {
    return (name || fallback)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, length)
      .padEnd(3, 'X');
  }

  private getDominantManufacturer(order?: PurchaseOrder): string {
    const lines = order?.lines ?? [];
    if (lines.length === 0) return 'HERST';
    const counts: Record<string, number> = {};
    for (const line of lines) {
      const mfr = (line.item?.manufacturer || '').trim();
      if (mfr) counts[mfr] = (counts[mfr] ?? 0) + 1;
    }
    if (Object.keys(counts).length === 0) return 'HERST';
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  private async generateOrderNumber(order?: PurchaseOrder, date = new Date()): Promise<string> {
    // Format: {NL-CODE}-{YYYYMMDD}-{001}-{HERST}
    // Beispiel: 400-20260408-001-BOSCH
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Niederlassungs-Code bestimmen (externalCode bevorzugt, sonst Namensprefix)
    let branchCode = 'NL';
    if (order?.branchId) {
      const branch = await this.branchesRepository.findOne({ where: { id: order.branchId } });
      if (branch) {
        const rawCode = (branch.externalCode ?? branch.name).toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
        branchCode = rawCode || 'NL';
      }
    }

    const manufacturerPrefix = this.extractNamePrefix(this.getDominantManufacturer(order), 'HERST');
    const prefix = `${branchCode}-${dateStr}`;

    // Suche nach Bestellungen mit diesem Prefix (gleicher Tag, gleiche NL)
    const existing = await this.ordersRepository
      .createQueryBuilder("order")
      .select("order.orderNumber", "orderNumber")
      .where("order.orderNumber LIKE :prefix", { prefix: `${prefix}-%` })
      .getRawMany();

    let max = 0;
    existing.forEach((row) => {
      const value = String(row.orderNumber || "");
      if (!value.startsWith(prefix + '-')) return;
      // Format: {prefix}-{seq}-{HERST} → seq ist der Teil nach dem prefix
      const afterPrefix = value.substring(prefix.length + 1);
      const seqStr = afterPrefix.split('-')[0];
      const num = Number(seqStr);
      if (!Number.isNaN(num)) max = Math.max(max, num);
    });

    const suffix = String(max + 1).padStart(3, "0");
    return `${prefix}-${suffix}-${manufacturerPrefix}`;
  }

  /** Ordnername für eine Niederlassung (sicher für Dateisystem) */
  private async getBranchFolder(branchId: string | null | undefined): Promise<string> {
    if (!branchId) return '_ALLGEMEIN';
    const branch = await this.branchesRepository.findOne({ where: { id: branchId } });
    if (!branch) return '_ALLGEMEIN';
    const code = (branch.externalCode ?? '').replace(/[^A-Z0-9]/gi, '').substring(0, 10).toUpperCase();
    const name = this.sanitizeStorageToken(branch.name).substring(0, 20);
    if (code && name) return `${code}_${name}`;
    return code || name || '_ALLGEMEIN';
  }

  private getPurchaseOrderStoragePath(): string {
    return (process.env.PURCHASE_ORDER_STORAGE_PATH || "/app/purchase-orders").trim();
  }

  private sanitizeStorageToken(value?: string | null): string {
    return (value ?? "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private getOrderDocumentYear(order: PurchaseOrder): string {
    const referenceDate = order.orderedAt ?? order.createdAt ?? new Date();
    return String(new Date(referenceDate).getFullYear());
  }

  private buildStoredOrderFilename(order: PurchaseOrder): string {
    const safeOrderNumber = this.sanitizeStorageToken(order.orderNumber ?? order.id) || "Bestellung";
    return `${safeOrderNumber}.pdf`;
  }

  private isValidOrderDocumentFilename(filename: string): boolean {
    return (
      /^[a-zA-Z0-9._-]+\.pdf$/.test(filename)
      && !filename.includes("..")
      && !filename.includes("/")
      && !filename.includes("\\")
    );
  }

  private async saveOrderPdfToStorage(order: PurchaseOrder, buffer?: Buffer): Promise<void> {
    try {
      const storagePath = this.getPurchaseOrderStoragePath();
      const pdfBuffer = buffer ?? (await this.buildOrderPdf(order));
      const filename = this.buildStoredOrderFilename(order);
      const refDate = new Date(order.orderedAt ?? order.createdAt ?? new Date());
      const year = String(refDate.getFullYear());
      const month = String(refDate.getMonth() + 1).padStart(2, '0');
      const branchFolder = await this.getBranchFolder(order.branchId);
      const targetDir = path.join(storagePath, branchFolder, year, month);

      await fs.mkdir(targetDir, { recursive: true });
      const fullPath = path.join(targetDir, filename);
      await fs.writeFile(fullPath, pdfBuffer);
      console.log(`[PurchasingService] PDF gespeichert: ${branchFolder}/${year}/${month}/${filename}`);
    } catch (error) {
      console.warn("[PurchasingService] PDF Ablage fehlgeschlagen:", error);
    }
  }
}
