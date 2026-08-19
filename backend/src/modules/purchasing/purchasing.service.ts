import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PurchaseSuggestionService } from "./purchase-suggestion.service";
import { promises as fs, Dirent } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, MoreThan, Repository } from "typeorm";

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
    @InjectRepository(Location)
    private readonly locationsRepository: Repository<Location>,
    private readonly itemsService: ItemsService,
    private readonly locationsService: LocationsService,
    private readonly stockService: StockService,
    private readonly emailService: EmailService,
    private readonly systemConfigService: SystemConfigService,
    private readonly loggingService: LoggingService,
    private readonly dataSource: DataSource,
    private readonly suggestionService: PurchaseSuggestionService,
  ) {}

  invalidateSuggestionsCache() {
    this.suggestionService.invalidateSuggestionsCache();
  }

  async findAll(params?: PurchaseOrderQueryParams & { branchId?: string | null; locationIds?: string[] }) {
    const sortBy = params?.sortBy ?? "createdAt";
    const sortDir = params?.sortDir === "ASC" ? "ASC" : "DESC";

    const qb = this.ordersRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.supplier", "supplier")
      .leftJoinAndSelect("order.branch", "branch")
      .leftJoinAndSelect("order.lines", "line")
      .leftJoinAndSelect("line.item", "item")
      .leftJoinAndSelect("item.codes", "itemCodes");

    if (params?.branchId) {
      qb.andWhere("order.branchId = :branchId", { branchId: params.branchId });
    }

    // Lager-Filter: nur Bestellungen des eigenen Lagers oder ohne Lager-Zuordnung
    if (params?.locationIds?.length) {
      qb.andWhere(
        "(order.locationId IN (:...locationIds) OR order.locationId IS NULL)",
        { locationIds: params.locationIds },
      );
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

    return qb.take(500).getMany();
  }

  async findOne(id: string, branchId?: string | null) {
    const where: Record<string, unknown> = { id };
    if (branchId) where.branchId = branchId;
    const order = await this.ordersRepository.findOne({
      where,
      relations: ["supplier", "lines", "lines.item", "lines.item.codes"],
    });
    if (!order) {
      throw new NotFoundException("Purchase order not found");
    }
    return order;
  }

  async getLastOrderForItem(itemId: string, branchId?: string | null) {
    const qb = this.ordersRepository
      .createQueryBuilder("order")
      .innerJoin("order.lines", "line", "line.itemId = :itemId", { itemId })
      .leftJoinAndSelect("order.supplier", "supplier")
      .addSelect("line.quantity", "line_quantity")
      .addSelect("line.packSize", "line_packSize")
      .where("order.status IN (:...statuses)", { statuses: ["ORDERED", "ARCHIVED"] })
      .orderBy("order.orderedAt", "DESC")
      .addOrderBy("order.createdAt", "DESC")
      .limit(1);

    if (branchId) {
      qb.andWhere("order.branchId = :branchId", { branchId });
    }

    const order = await qb.getOne();
    if (!order) return null;

    const line = await this.linesRepository
      .createQueryBuilder("line")
      .where("line.orderId = :orderId", { orderId: order.id })
      .andWhere("line.itemId = :itemId", { itemId })
      .getOne();

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderedAt: order.orderedAt,
      supplierName: order.supplier?.name ?? null,
      quantity: line?.quantity ?? null,
      packSize: line?.packSize ?? null,
    };
  }

  async create(payload: {
    supplierId: string;
    orderNumber?: string;
    note?: string;
    lines: Array<{ itemId: string; quantity: number; packSize?: number }>;
    branchId?: string | null;
    locationId?: string | null;
  }) {
    const supplier = await this.supplierRepository.findOne({ where: { id: payload.supplierId } });
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }

    if (!payload.lines || payload.lines.length === 0) {
      throw new BadRequestException("Purchase order needs at least one line");
    }

    const itemIds = payload.lines.map((l) => l.itemId);
    const loadedItems = await this.itemsRepository.findBy({ id: In(itemIds) });
    const itemMap = new Map(loadedItems.map((i) => [i.id, i]));

    const lines: PurchaseOrderLine[] = [];
    for (const line of payload.lines) {
      const item = itemMap.get(line.itemId);
      if (!item) {
        throw new NotFoundException(`Item ${line.itemId} not found`);
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
      locationId: payload.locationId ?? null,
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
      
      // Log: Status-Ã„nderung
      if (oldStatus !== payload.status) {
        await this.loggingService.logInfo(
          LogCategory.PURCHASE,
          'purchase_order_status_changed',
          `Bestellung ${order.orderNumber || order.id} Status geÃ¤ndert: ${oldStatus} â†’ ${payload.status}`,
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
      // PDF beim erstmaligen Bestellen erzeugen
      const full = await this.findOneWithRelations(saved.id);
      await this.saveOrderPdfToStorage(full);
    }

    this.invalidateSuggestionsCache();
    return saved;
  }

  async addLine(
    orderId: string,
    payload: { itemId: string; quantity: number },
    branchId?: string | null,
  ): Promise<PurchaseOrder> {
    const order = await this.findOne(orderId, branchId);
    if (order.status !== "DRAFT") {
      throw new BadRequestException("Artikel kÃ¶nnen nur zu EntwÃ¼rfen hinzugefÃ¼gt werden");
    }
    const item = await this.itemsService.findOne(payload.itemId);
    if (!item) throw new NotFoundException("Artikel nicht gefunden");

    const existing = order.lines?.find((l) => l.item?.id === payload.itemId);
    if (existing) {
      existing.quantity += Math.max(1, payload.quantity);
      await this.linesRepository.save(existing);
    } else {
      const line = this.linesRepository.create({ order, item, quantity: Math.max(1, payload.quantity), receivedQuantity: 0 });
      await this.linesRepository.save(line);
    }
    this.invalidateSuggestionsCache();
    return this.findOne(orderId, branchId);
  }

  async updateLine(
    orderId: string,
    lineId: string,
    payload: { quantity: number },
    branchId?: string | null,
  ): Promise<PurchaseOrder> {
    const order = await this.findOne(orderId, branchId);
    if (order.status !== "DRAFT") {
      throw new BadRequestException("Positionen kÃ¶nnen nur bei EntwÃ¼rfen bearbeitet werden");
    }
    const line = order.lines?.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException("Position nicht gefunden");
    line.quantity = Math.max(1, payload.quantity);
    await this.linesRepository.save(line);
    this.invalidateSuggestionsCache();
    return this.findOne(orderId, branchId);
  }

  async removeLine(
    orderId: string,
    lineId: string,
    branchId?: string | null,
  ): Promise<PurchaseOrder> {
    const order = await this.findOne(orderId, branchId);
    if (order.status !== "DRAFT") {
      throw new BadRequestException("Positionen kÃ¶nnen nur bei EntwÃ¼rfen entfernt werden");
    }
    if (!order.lines?.length || order.lines.length <= 1) {
      throw new BadRequestException("Die Bestellung muss mindestens eine Position behalten");
    }
    const line = order.lines?.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException("Position nicht gefunden");
    await this.linesRepository.delete(lineId);
    this.invalidateSuggestionsCache();
    return this.findOne(orderId, branchId);
  }

  async receiveOrder(
    id: string,
    payload: { lines: Array<{ lineId: string; receivedQuantity?: number }>; deliveryNoteNumber?: string },
    userId?: string,
    branchId?: string | null,
  ) {
    const order = await this.findOne(id, branchId);
    if (order.status !== "ORDERED" && order.status !== "DRAFT") {
      throw new BadRequestException("Only active orders can receive goods");
    }
    if (order.status === "DRAFT") {
      throw new BadRequestException("Eine Bestellung muss erst aufgegeben werden (Status: ORDERED), bevor Waren eingehen kÃ¶nnen.");
    }

    const warehouseLocations = await this.locationsService.findAll({ type: "WAREHOUSE", includeVehicles: true });
    const defaultWarehouse = warehouseLocations[0] ?? null;

    // Batch-load all items for the order lines to avoid N+1 queries
    const lineItemIds = [...new Set(order.lines.map((l) => l.item.id))];
    const lineItems = await this.itemsRepository.find({
      where: { id: In(lineItemIds) },
      relations: ["storageLocation"],
    });
    const lineItemMap = new Map(lineItems.map((i) => [i.id, i]));

    const savedOrder = await this.dataSource.transaction(async (manager) => {
      let hasAnyBookedQuantity = false;

      for (const linePayload of payload.lines) {
        const line = order.lines.find((entry) => entry.id === linePayload.lineId);
        if (!line) {
          throw new NotFoundException("Order line not found");
        }

        const remaining = line.quantity - line.receivedQuantity;
        if (remaining <= 0) continue;

        const toReceive = linePayload.receivedQuantity ?? remaining;
        if (toReceive <= 0) continue;

        hasAnyBookedQuantity = true;
        line.receivedQuantity = Math.min(line.quantity, line.receivedQuantity + toReceive);

        const item = lineItemMap.get(line.item.id);
        const locationId = item?.storageLocation?.id ?? defaultWarehouse?.id ?? null;
        if (!locationId) {
          throw new BadRequestException("Keine Lagerposition fuer Wareneingang hinterlegt.");
        }

        // StockMovement wird im selben EntityManager-Kontext gespeichert wie die Order,
        // sodass ein Rollback des Order-Save auch die Bestandsbewegung rückgängig macht.
        // applyMovementToStock/logStockMovement nutzen noch eigene Repositories (partieller Fix).
        await this.stockService.recordMovement(
          {
            itemId: line.item.id,
            locationId,
            userId,
            type: "CHECKIN",
            quantity: toReceive,
            occurredAt: new Date().toISOString(),
            note: `Wareneingang ${order.orderNumber ?? order.id}${payload.deliveryNoteNumber?.trim() ? ` · LS: ${payload.deliveryNoteNumber.trim()}` : ""}`,
            source: order.orderNumber ?? `purchase-order:${order.id}`,
          },
          manager,
        );
      }

      if (!hasAnyBookedQuantity) {
        throw new BadRequestException("Keine gueltigen Mengen fuer den Wareneingang uebergeben.");
      }

      const allReceived = order.lines.every((line) => line.receivedQuantity >= line.quantity);
      if (allReceived) {
        order.status = "ARCHIVED";
        order.receivedAt = new Date();
        if (!order.orderedAt) order.orderedAt = new Date();
      } else {
        order.status = "ORDERED";
        order.receivedAt = null;
        if (!order.orderedAt) order.orderedAt = new Date();
      }

      if (payload.deliveryNoteNumber !== undefined) {
        const newNote = payload.deliveryNoteNumber.trim();
        if (newNote) {
          const existing = order.deliveryNoteNumber
            ? order.deliveryNoteNumber.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
          if (!existing.includes(newNote)) {
            existing.push(newNote);
          }
          order.deliveryNoteNumber = existing.join(", ");

          const history = Array.isArray(order.deliveryNoteHistory) ? order.deliveryNoteHistory : [];
          const alreadyInHistory = history.some((entry) => entry.number === newNote);
          if (!alreadyInHistory) {
            history.push({ number: newNote, date: new Date().toISOString() });
          }
          order.deliveryNoteHistory = history;
        }
      }

      return manager.save(order);
    });

    this.invalidateSuggestionsCache();
    return savedOrder;
  }

  async remove(id: string, branchId?: string | null): Promise<void> {
    const order = await this.findOne(id, branchId);
    await this.deleteOrderPdfFromStorage(order);
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

    // PDFs vom Dateisystem lÃ¶schen
    for (const order of orders) {
      await this.deleteOrderPdfFromStorage(order);
    }

    await this.ordersRepository.remove(orders);
    this.invalidateSuggestionsCache();

    await this.loggingService.logInfo(
      LogCategory.PURCHASE,
      'purchase_orders_purged',
      `Bestellarchiv bereinigt: ${orders.length} Bestellungen Ã¤lter als ${years} Jahre gelÃ¶scht`,
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
      `E-Mail-Versand fÃ¼r Bestellung ${order.orderNumber || order.id} gestartet`,
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
        `E-Mail-Versand fehlgeschlagen: Kein EmpfÃ¤nger fÃ¼r Bestellung ${order.orderNumber || order.id}`,
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
        `E-Mail-Versand fÃ¼r Bestellung ${order.orderNumber || order.id} fehlgeschlagen: ${err.message}`,
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

  getSuggestions(branchId: string | null | undefined, refresh = false, locationIds?: string[], warehouseId?: string) {
    return this.suggestionService.getSuggestions(branchId, refresh, locationIds, warehouseId);
  }

  /** @deprecated internal â€” kept only until full block removal below */

  async listOrderDocuments(params?: OrderDocumentQueryParams, branchId?: string | null): Promise<StoredOrderDocumentEntry[]> {
    const storagePath = this.getPurchaseOrderStoragePath();
    try {
      await fs.access(storagePath);
    } catch {
      return [];
    }

    try {
      // Lookup-Map: relPath â†’ Supplier-Info (neue, mittlere und alte Pfade)
      const fileToSupplier = new Map<string, { supplierId: string | null; supplierName: string | null }>();
      const allOrders = await this.ordersRepository.find({ where: branchId ? { branchId } : undefined, relations: ["supplier"] });

      // Cache folder names to avoid NÃ—2 DB queries per order
      const branchFolderCache = new Map<string | null, string>();
      const locationFolderCache = new Map<string | null, string>();
      const getBranchFolderCached = (bid: string | null | undefined) => {
        const key = bid ?? null;
        if (!branchFolderCache.has(key)) {
          branchFolderCache.set(key, this.getBranchFolder(bid) as unknown as string);
        }
        return branchFolderCache.get(key)!;
      };
      const getLocationFolderCached = (lid: string | null | undefined) => {
        const key = lid ?? null;
        if (!locationFolderCache.has(key)) {
          locationFolderCache.set(key, this.getLocationFolder(lid) as unknown as string);
        }
        return locationFolderCache.get(key)!;
      };

      // Resolve unique branchIds and locationIds in one pass
      const uniqueBranchIds = [...new Set(allOrders.map((o) => o.branchId ?? null))];
      const uniqueLocationIds = [...new Set(allOrders.map((o) => o.locationId ?? null))];
      await Promise.all([
        ...uniqueBranchIds.map(async (bid) => branchFolderCache.set(bid, await this.getBranchFolder(bid))),
        ...uniqueLocationIds.map(async (lid) => locationFolderCache.set(lid, await this.getLocationFolder(lid))),
      ]);

      for (const order of allOrders) {
        const filename = this.buildStoredOrderFilename(order);
        const refDate = new Date(order.orderedAt ?? order.createdAt ?? new Date());
        const year = String(refDate.getFullYear());
        const month = String(refDate.getMonth() + 1).padStart(2, '0');
        const branchFolder = getBranchFolderCached(order.branchId);
        const locationFolder = getLocationFolderCached(order.locationId);
        const entry = { supplierId: order.supplier?.id ?? null, supplierName: order.supplier?.name ?? null };
        // Aktuelle Struktur: branchFolder/locationFolder/YYYY/MM/filename.pdf
        fileToSupplier.set(`${branchFolder}/${locationFolder}/${year}/${month}/${filename}`, entry);
        // Mittlere Struktur (ohne Lager): branchFolder/YYYY/MM/filename.pdf
        fileToSupplier.set(`${branchFolder}/${year}/${month}/${filename}`, entry);
        // Ã„lteste Struktur: YYYY/filename.pdf
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
          // Struktur: branchFolder/[locationFolder/]YYYY/MM/filename.pdf
          const branchFolderName = topEntry.name;
          const branchPath = path.join(storagePath, branchFolderName);
          let branchSubDirs: Dirent<string>[] = [];
          try { branchSubDirs = await fs.readdir(branchPath, { withFileTypes: true }); } catch { continue; }

          for (const branchSub of branchSubDirs) {
            if (!branchSub.isDirectory()) continue;

            if (/^\d{4}$/.test(branchSub.name)) {
              // Mittlere Struktur: branchFolder/YYYY/MM/filename.pdf
              const year = Number.parseInt(branchSub.name, 10);
              if (params?.year && year !== params.year) continue;
              const yearPath = path.join(branchPath, branchSub.name);
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
                  const relPath = `${branchFolderName}/${branchSub.name}/${monthDir.name}/${file.name}`;
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
            } else {
              // Aktuelle Struktur: branchFolder/locationFolder/YYYY/MM/filename.pdf
              const locationFolderName = branchSub.name;
              const locationPath = path.join(branchPath, locationFolderName);
              let yearDirs: Dirent<string>[] = [];
              try { yearDirs = await fs.readdir(locationPath, { withFileTypes: true }); } catch { continue; }
              for (const yearDir of yearDirs) {
                if (!yearDir.isDirectory() || !/^\d{4}$/.test(yearDir.name)) continue;
                const year = Number.parseInt(yearDir.name, 10);
                if (params?.year && year !== params.year) continue;
                const yearPath = path.join(locationPath, yearDir.name);
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
                    const relPath = `${branchFolderName}/${locationFolderName}/${yearDir.name}/${monthDir.name}/${file.name}`;
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

    // Niederlassungs-Isolation: Token aus Dateinamen direkt in der DB prÃ¼fen (kein Full-Load)
    if (branchId) {
      const token = filename.replace(/\.pdf$/i, "");
      const owned = await this.ordersRepository.findOne({
        where: [
          { branchId, orderNumber: token },
          { branchId, id: token },
        ],
        select: ["id"],
      });
      if (!owned) {
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
    const template = await this.systemConfigService.getPurchaseOrderPdfTemplate(order.branchId);
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

    html = replaceSimple(html, "title", escapeHtml(orderNumber));
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

/* Multi-page pagination fixes */
@media print {
  body {
    height: auto !important;
    overflow: visible !important;
  }
}

.lines-table thead,
.items-table thead {
  display: table-header-group;
}

.lines-table tbody,
.items-table tbody {
  display: table-row-group;
}

.lines-table tbody tr,
.items-table tbody tr {
  page-break-inside: avoid;
  break-inside: avoid;
}

.totals,
.note {
  page-break-inside: avoid;
  break-inside: avoid;
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
      .join(" Â· ");
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
          bottom: "36px",
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

    // SELECT FOR UPDATE prevents duplicate order numbers under concurrent requests
    const suffix = await this.dataSource.transaction(async (manager) => {
      const existing: Array<{ orderNumber: string }> = await manager.query(
        `SELECT orderNumber FROM purchase_orders WHERE orderNumber LIKE ? FOR UPDATE`,
        [`${prefix}-%`],
      );
      let max = 0;
      for (const row of existing) {
        const value = String(row.orderNumber || "");
        if (!value.startsWith(prefix + "-")) continue;
        const afterPrefix = value.substring(prefix.length + 1);
        const seqStr = afterPrefix.split("-")[0];
        const num = Number(seqStr);
        if (!Number.isNaN(num)) max = Math.max(max, num);
      }
      return String(max + 1).padStart(3, "0");
    });

    return `${prefix}-${suffix}-${manufacturerPrefix}`;
  }

  /** Ordnername fÃ¼r eine Niederlassung (sicher fÃ¼r Dateisystem) */
  private async getBranchFolder(branchId: string | null | undefined): Promise<string> {
    if (!branchId) return '_ALLGEMEIN';
    const branch = await this.branchesRepository.findOne({ where: { id: branchId } });
    if (!branch) return '_ALLGEMEIN';
    const code = (branch.externalCode ?? '').replace(/[^A-Z0-9]/gi, '').substring(0, 10).toUpperCase();
    const name = this.sanitizeStorageToken(branch.name).substring(0, 20);
    if (code && name) return `${code}_${name}`;
    return code || name || '_ALLGEMEIN';
  }

  /** Ordnername fÃ¼r ein Lager (sicher fÃ¼r Dateisystem), z.B. "002_Tonerlager" */
  private async getLocationFolder(locationId: string | null | undefined): Promise<string> {
    if (!locationId) return '_ALLE_LAGER';
    const loc = await this.locationsRepository.findOne({ where: { id: locationId } });
    if (!loc) return '_ALLE_LAGER';
    const code = this.sanitizeStorageToken(loc.code).substring(0, 10).toUpperCase();
    const name = this.sanitizeStorageToken(loc.name ?? '').substring(0, 20);
    if (code && name) return `${code}_${name}`;
    return code || name || '_ALLE_LAGER';
  }

  private getPurchaseOrderStoragePath(): string {
    return (process.env.PURCHASE_ORDER_STORAGE_PATH || "/app/purchase-orders").trim();
  }

  private sanitizeStorageToken(value?: string | null): string {
    return (value ?? "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "");
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

  private async findOneWithRelations(id: string): Promise<PurchaseOrder> {
    const order = await this.ordersRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.supplier", "supplier")
      .leftJoinAndSelect("order.lines", "line")
      .leftJoinAndSelect("line.item", "item")
      .where("order.id = :id", { id })
      .getOne();
    if (!order) throw new NotFoundException("Purchase order not found");
    return order;
  }

  private async deleteOrderPdfFromStorage(order: PurchaseOrder, overrideOrderNumber?: string): Promise<void> {
    try {
      const storagePath = this.getPurchaseOrderStoragePath();
      const token = overrideOrderNumber ?? order.orderNumber ?? order.id;
      const filename = `${this.sanitizeStorageToken(token) || "Bestellung"}.pdf`;
      const refDate = new Date(order.orderedAt ?? order.createdAt ?? new Date());
      const year = String(refDate.getFullYear());
      const month = String(refDate.getMonth() + 1).padStart(2, "0");
      const branchFolder = await this.getBranchFolder(order.branchId);
      const locationFolder = await this.getLocationFolder(order.locationId);

      const candidates = [
        path.join(storagePath, branchFolder, locationFolder, year, month, filename), // aktuelle Struktur
        path.join(storagePath, branchFolder, year, month, filename),                 // alte Struktur (ohne Lager)
        path.join(storagePath, year, filename),                                      // Ã¤lteste Struktur
      ];
      for (const fullPath of candidates) {
        try { await fs.unlink(fullPath); } catch { /* nicht vorhanden â€“ ok */ }
      }
    } catch (error) {
      /* PDF nicht gefunden â€“ ok */
    }
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
      const locationFolder = await this.getLocationFolder(order.locationId);
      const targetDir = path.join(storagePath, branchFolder, locationFolder, year, month);

      await fs.mkdir(targetDir, { recursive: true });
      const fullPath = path.join(targetDir, filename);
      await fs.writeFile(fullPath, pdfBuffer);
    } catch (error) {
      /* PDF-Ablage fehlgeschlagen â€“ kein fataler Fehler */
    }
  }
}
