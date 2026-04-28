import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, IsNull, Repository } from "typeorm";
import * as fs from "fs/promises";
import * as path from "path";
import sharp from "sharp";

import { CreateItemDto } from "./dto/create-item.dto";
import { UpdateItemDto } from "./dto/update-item.dto";
import { ItemCode } from "./entities/item-code.entity";
import { Item } from "./entities/item.entity";
import { Location } from "../locations/entities/location.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { LoggingService } from "../logging/services/logging.service";
import { LogCategory, LogLevel } from "../logging/entities/system-log.entity";

const sanitizeCodes = (codes: string[] | undefined): string[] => {
  if (!codes) {
    return [];
  }
  const normalized = codes
    .map((code) => code.trim())
    .filter((code) => code.length > 0)
    .map((code) => code.toUpperCase());
  return Array.from(new Set(normalized));
};

const parseOptionalInt = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.max(0, Math.floor(parsed));
};

const parseOptionalPrice = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed.toFixed(2);
};

const csvEscape = (value: unknown): string => {
  const raw = value === undefined || value === null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

type BulkImportAction = "CREATE" | "UPDATE" | "SKIP" | "ERROR";

interface BulkImportRowResult {
  row: number;
  code: string;
  action: BulkImportAction;
  reason: string | null;
}

interface BulkImportPreviewResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  rows: BulkImportRowResult[];
}

interface NormalizedBulkImportItem {
  row: number;
  code: string;
  isUpdate: boolean; // true = existing article, update it; false = create new
  description: string;
  descriptionSecondary: string | null;
  manufacturer: string;
  productGroup: string;
  qrCodeValue: string;
  targetStock: number;
  reorderPoint: number | null;
  minimumStock: number | null;
  storageLocationId?: string;
  supplierId?: string;
  price: string | null;
  packSize: number | null;
  orderQuantity: number | null;
  currentQuantity?: number;
  alternateCodes: string[];
}

interface BulkImportAnalysis extends BulkImportPreviewResult {
  normalized: NormalizedBulkImportItem[];
}

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    @InjectRepository(Item)
    private readonly repository: Repository<Item>,
    @InjectRepository(ItemCode)
    private readonly codesRepository: Repository<ItemCode>,
    @InjectRepository(StockLevel)
    private readonly stockLevelsRepository: Repository<StockLevel>,
    @InjectRepository(StockMovement)
    private readonly stockMovementsRepository: Repository<StockMovement>,
    @InjectRepository(Location)
    private readonly locationsRepository: Repository<Location>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    private readonly loggingService: LoggingService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(params?: { page?: number; limit?: number; search?: string; manufacturer?: string; productGroup?: string; branchId?: string | null; locationIds?: string[] }) {
    try {
      const page = Math.max(1, Number(params?.page) || 1);
      // Höheres Limit zulassen, damit Offline-Sync den kompletten Artikelstamm holen kann.
      // API-Maximum: 50.000 – verhindert DoS durch einzelne Requests, deckt aber auch große Bestände ab.
      // Interne Aufrufe (z.B. exportItemsCsv) übergeben limit direkt und umgehen diese Grenze nicht.
      const limit = Math.min(Math.max(1, Number(params?.limit) || 50), 50000);

      this.logger.debug(`findAll called with page=${page}, limit=${limit}, search=${params?.search}`);

      const qb = this.repository.createQueryBuilder("item")
        .leftJoinAndSelect("item.codes", "code")
        .leftJoinAndSelect("item.storageLocation", "storageLocation")
        .leftJoinAndSelect("item.supplier", "supplier")
        .distinct(true)
        .orderBy("item.manufacturer", "ASC")
        .addOrderBy("item.productGroup", "ASC")
        .addOrderBy("item.description", "ASC");

      // Lager-Filterung: Benutzer mit Lager-Zuweisung sieht nur Artikel deren Lagerort
      // direkt einem der zugewiesenen Lager entspricht, oder ein Kind/Enkelelement davon ist.
      if (params?.locationIds?.length) {
        qb.leftJoin("storageLocation.parent", "slParent")
          .leftJoin("slParent.parent", "slGrandparent")
          .andWhere(
            "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds) OR slGrandparent.id IN (:...locationIds))",
            { locationIds: params.locationIds }
          );
      } else if (params?.branchId) {
        qb.andWhere("item.branchId = :branchId", { branchId: params.branchId });
      }

      if (params?.search) {
        const term = params.search.trim();
        if (term.length >= 3) {
          // Fulltext-Suche für Textfelder (nutzt idx_items_fulltext), Prefix-Wildcard für Teilwort-Suche
          // Boolean-Mode-Operatoren aus Suchbegriff entfernen um Syntax-Fehler zu vermeiden
          const ftTerm = term.replace(/[+\-><()~*"@]+/g, " ").trim() + "*";
          qb.andWhere(
            `(
              item.code LIKE :q
              OR item.qrCodeValue LIKE :q
              OR code.code LIKE :q
              OR item.description LIKE :q
              OR item.descriptionSecondary LIKE :q
              OR item.manufacturer LIKE :q
              OR MATCH(item.description, item.manufacturer, item.productGroup) AGAINST(:ft IN BOOLEAN MODE)
            )`,
            { q: `%${term}%`, ft: ftTerm }
          );
        } else {
          // Kurze Suchbegriffe: Standard-LIKE (Fulltext benötigt mind. 3 Zeichen)
          qb.andWhere(
            `(
              item.code LIKE :q
              OR item.description LIKE :q
              OR item.descriptionSecondary LIKE :q
              OR item.manufacturer LIKE :q
              OR item.productGroup LIKE :q
              OR item.qrCodeValue LIKE :q
              OR code.code LIKE :q
            )`,
            { q: `%${term}%` }
          );
        }
      }
      if (params?.manufacturer) {
        qb.andWhere("item.manufacturer = :m", { m: params.manufacturer });
      }
      if (params?.productGroup) {
        qb.andWhere("item.productGroup = :g", { g: params.productGroup });
      }

      qb.skip((page - 1) * limit).take(limit);

      const [items, total] = await qb.getManyAndCount();

      if (items.length > 0) {
        const itemIds = items.map((item) => item.id);
        const locationIds = items
          .map((item) => item.storageLocation?.id)
          .filter((id): id is string => Boolean(id));

        const quantityMap = new Map<string, number>();
        if (locationIds.length > 0) {
          const stockLevels = await this.stockLevelsRepository
            .createQueryBuilder("stock")
            .select("stock.itemId", "itemId")
            .addSelect("stock.locationId", "locationId")
            .addSelect("stock.quantity", "quantity")
            .where("stock.itemId IN (:...itemIds)", { itemIds })
            .andWhere("stock.locationId IN (:...locationIds)", { locationIds })
            .getRawMany();

          stockLevels.forEach((row: { itemId: string; locationId: string; quantity: number }) => {
            const key = `${row.itemId}_${row.locationId}`;
            const parsed = Number(row.quantity);
            quantityMap.set(key, Number.isNaN(parsed) ? 0 : parsed);
          });
        }

        items.forEach((item) => {
          const locationId = item.storageLocation?.id ?? null;
          if (!locationId) {
            (item as any).currentQuantity = null;
            return;
          }
          const key = `${item.id}_${locationId}`;
          (item as any).currentQuantity = quantityMap.get(key) ?? 0;
        });
      }
      
      this.logger.debug(`findAll returned ${items.length} items out of ${total} total`);
      
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    } catch (error) {
      this.logger.error(
        `Fehler in findAll: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );
      
      // Weitergabe des Fehlers an den Controller
      throw error;
    }
  }

  async countItems(branchId?: string | null, locationIds?: string[]): Promise<number> {
    if (locationIds?.length) {
      const qb = this.repository
        .createQueryBuilder("item")
        .leftJoin("item.storageLocation", "storageLocation")
        .leftJoin("storageLocation.parent", "slParent");
      if (branchId) qb.where("item.branchId = :branchId", { branchId });
      qb.andWhere(
        "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))",
        { locationIds },
      );
      return qb.getCount();
    }
    return this.repository.count({ where: branchId ? { branchId } : undefined });
  }

  async exportItemsCsv(params?: { search?: string; manufacturer?: string; productGroup?: string; branchId?: string | null; locationIds?: string[] }): Promise<Buffer> {
    const { items } = await this.findAll({
      limit: 200000,
      search: params?.search,
      manufacturer: params?.manufacturer,
      productGroup: params?.productGroup,
      branchId: params?.branchId,
      locationIds: params?.locationIds,
    });

    const headers = [
      "code",
      "description",
      "description_secondary",
      "manufacturer",
      "product_group",
      "supplier_id",
      "supplier_name",
      "storage_location_id",
      "storage_location_code",
      "storage_location_name",
      "qr_code",
      "target_stock",
      "reorder_point",
      "minimum_stock",
      "current_quantity",
      "price_eur",
      "pack_size",
      "order_quantity",
      "alternate_codes",
    ];

    const rows = items.map((item) => {
      const currentQuantity = (item as any).currentQuantity;
      return [
        item.code,
        item.description,
        item.descriptionSecondary ?? "",
        item.manufacturer,
        item.productGroup,
        item.supplier?.id ?? "",
        item.supplier?.name ?? "",
        item.storageLocation?.id ?? "",
        item.storageLocation?.code ?? "",
        item.storageLocation?.name ?? "",
        item.qrCodeValue ?? "",
        item.targetStock ?? 0,
        item.reorderPoint ?? "",
        item.minimumStock ?? "",
        item.storageLocation ? (currentQuantity ?? 0) : "",
        item.price ?? "",
        item.packSize ?? "",
        item.orderQuantity ?? "",
        item.codes?.length ? item.codes.map((entry) => entry.code).join(" ") : "",
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(";")).join("\n");
    return Buffer.from(`\uFEFF${csv}`, "utf8");
  }

  async findOne(id: string, branchId?: string | null): Promise<Item | null> {
    try {
      this.logger.debug(`Suche Artikel mit ID: ${id}`);
      const where: Record<string, unknown> = { id };
      if (branchId) where.branchId = branchId;
      const item = await this.repository.findOne({
        where,
        relations: ['codes', 'storageLocation', 'supplier']
      });
      return item || null;
    } catch (error) {
      this.logger.error(`Fehler beim Abrufen des Artikels ${id}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async findOneByCode(code: string, branchId?: string | null): Promise<Item | null> {
    try {
      const where: Record<string, unknown> = { code };
      if (branchId) where.branchId = branchId;
      return await this.repository.findOne({ where });
    } catch (error) {
      this.logger.error(`Fehler beim Abrufen des Artikels nach Code ${code}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async findOneByAnyCode(code: string, branchId?: string | null, locationIds?: string[]): Promise<Item | null> {
    try {
      const normalized = code.trim();
      if (!normalized) {
        return null;
      }

      // Prüfe Hauptcode zuerst
      const directWhere: Record<string, unknown> = { code: normalized };
      if (branchId) directWhere.branchId = branchId;
      const direct = await this.repository.findOne({
        where: directWhere,
        relations: ['codes', 'storageLocation', 'storageLocation.parent', 'storageLocation.parent.parent', 'supplier']
      });
      const found = direct ?? await (async () => {
        // Prüfe alternative Codes – direkt nach branchId filtern
        const altWhere: Record<string, unknown> = { code: normalized };
        if (branchId) altWhere.branchId = branchId;
        else altWhere.branchId = IsNull();
        const alias = await this.codesRepository.findOne({
          where: altWhere,
          relations: ["item", "item.codes", "item.storageLocation", "item.storageLocation.parent", "item.storageLocation.parent.parent", "item.supplier"]
        });
        return alias?.item ?? null;
      })();

      // Lager-Filter: Artikel muss im zugewiesenen Lager liegen (location-Hierarchie)
      if (found && locationIds?.length) {
        const ids = new Set(locationIds);
        const locId = (found.storageLocation as any)?.id ?? null;
        const parentId = (found.storageLocation as any)?.parent?.id ?? null;
        const grandparentId = (found.storageLocation as any)?.parent?.parent?.id ?? null;
        const inLocation = locId && (ids.has(locId) || (parentId && ids.has(parentId)) || (grandparentId && ids.has(grandparentId)));
        if (!inLocation) return null;
      }

      if (found) {
        const qb = this.stockLevelsRepository
          .createQueryBuilder('sl')
          .innerJoin('sl.location', 'loc')
          .select('COALESCE(SUM(sl.quantity), 0)', 'total')
          .where('sl.itemId = :itemId', { itemId: found.id })
          .andWhere('sl.vehicleId IS NULL')
          .andWhere('loc.type != :vehicleType', { vehicleType: 'VEHICLE' });
        if (branchId) {
          qb.andWhere('loc.branchId = :branchId', { branchId });
        }
        const rows = await qb.getRawOne<{ total: string }>();
        (found as any).currentQuantity = Number(rows?.total ?? 0);
      }
      return found;
    } catch (error) {
      this.logger.error(`Fehler beim Abrufen des Artikels nach Code ${code}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async create(dto: CreateItemDto & { branchId?: string | null }): Promise<Item> {
    const { alternateCodes, storageLocationId, supplierId, price, packSize, orderQuantity, currentQuantity: _currentQuantity, branchId, ...rest } = dto;
    const effectiveBranchId = branchId ?? null;
    const existsWhere: Record<string, unknown> = { code: rest.code };
    if (effectiveBranchId) existsWhere.branchId = effectiveBranchId;
    else existsWhere.branchId = IsNull();
    const exists = await this.repository.findOne({ where: existsWhere });
    if (exists) {
      throw new Error('Artikelnummer/QR-Code bereits vergeben');
    }
    const normalizedPrice = price !== undefined && Number.isFinite(Number(price))
      ? Number(price).toFixed(2)
      : null;
    const entity = this.repository.create({
      ...rest,
      description: rest.description?.trim(),
      descriptionSecondary: rest.descriptionSecondary?.trim() || null,
      storageLocation: storageLocationId ? ({ id: storageLocationId } as any) : null,
      supplier: supplierId ? ({ id: supplierId } as any) : null,
      price: normalizedPrice,
      packSize: packSize !== undefined ? packSize : null,
      orderQuantity: orderQuantity !== undefined && Number(orderQuantity) > 0 ? orderQuantity : null,
      branchId: effectiveBranchId,
    });
    const codes = sanitizeCodes(alternateCodes);
    if (codes.length > 0) {
      const altWhere = effectiveBranchId
        ? { code: In(codes), branchId: effectiveBranchId }
        : { code: In(codes), branchId: IsNull() };
      const existingCodes = await this.codesRepository.find({ where: altWhere });
      if (existingCodes.length > 0) {
        throw new Error('Alternativer QR-Code bereits vergeben: ' + existingCodes[0].code);
      }
      entity.codes = codes.map((code) => this.codesRepository.create({ code, branchId: effectiveBranchId as string }));
    }
    return this.repository.save(entity);
  }

  async previewBulk(dtos: CreateItemDto[], branchId?: string | null): Promise<BulkImportPreviewResult> {
    const analysis = await this.analyzeBulkImport(dtos, branchId);
    return {
      created: analysis.created,
      updated: analysis.updated,
      skipped: analysis.skipped,
      errors: analysis.errors,
      rows: analysis.rows,
    };
  }

  async createBulk(dtos: CreateItemDto[], branchId?: string | null): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
    const analysis = await this.analyzeBulkImport(dtos, branchId);
    const result = {
      created: 0,
      updated: 0,
      skipped: analysis.skipped,
      errors: [...analysis.errors],
    };
    if (analysis.normalized.length === 0) {
      return result;
    }

    const toCreate = analysis.normalized.filter((n) => !n.isUpdate);
    const toUpdate = analysis.normalized.filter((n) => n.isUpdate);

    // === NEUE ARTIKEL ANLEGEN ===
    const initialStockByCode = new Map<string, { locationId: string; quantity: number; targetQuantity: number }>();
    const entities: Item[] = [];
    const altCodesByCode = new Map<string, string[]>();
    for (const normalized of toCreate) {
      const entity = this.repository.create({
        code: normalized.code,
        branchId: branchId ?? null,
        description: normalized.description,
        descriptionSecondary: normalized.descriptionSecondary,
        manufacturer: normalized.manufacturer,
        productGroup: normalized.productGroup,
        qrCodeValue: normalized.qrCodeValue,
        targetStock: normalized.targetStock,
        reorderPoint: normalized.reorderPoint,
        minimumStock: normalized.minimumStock,
        storageLocation: normalized.storageLocationId ? ({ id: normalized.storageLocationId } as any) : null,
        supplier: normalized.supplierId ? ({ id: normalized.supplierId } as any) : null,
        price: normalized.price,
        packSize: normalized.packSize,
        orderQuantity: normalized.orderQuantity,
      });
      // Codes NICHT als Cascade setzen – separat nach dem Save einfügen
      // um den "itemId has no default value" Fehler beim Batch-Save zu vermeiden
      if (normalized.alternateCodes.length > 0) {
        altCodesByCode.set(normalized.code, normalized.alternateCodes);
      }
      entities.push(entity);
      if (normalized.storageLocationId && normalized.currentQuantity !== undefined) {
        initialStockByCode.set(normalized.code, {
          locationId: normalized.storageLocationId,
          quantity: normalized.currentQuantity,
          targetQuantity: normalized.targetStock,
        });
      }
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < entities.length; i += BATCH_SIZE) {
      const batch = entities.slice(i, i + BATCH_SIZE);
      try {
        const savedBatch = await this.repository.save(batch);
        result.created += savedBatch.length;

        // Alt-Codes separat einfügen (nach dem Save, damit itemId bekannt ist)
        const codeEntries = savedBatch.flatMap((saved) => {
          const altCodes = altCodesByCode.get(saved.code) ?? [];
          return altCodes.map((code) => this.codesRepository.create({ code, branchId: branchId ?? null as any, item: { id: saved.id } as any }));
        });
        if (codeEntries.length > 0) {
          await this.codesRepository.save(codeEntries);
        }

        const stockEntries: StockLevel[] = [];
        for (const saved of savedBatch) {
          const stock = initialStockByCode.get(saved.code);
          if (!stock) continue;
          stockEntries.push(
            this.stockLevelsRepository.create({
              item: { id: saved.id } as any,
              location: { id: stock.locationId } as any,
              vehicle: null,
              quantity: stock.quantity,
              targetQuantity: stock.targetQuantity,
            }),
          );
        }
        if (stockEntries.length > 0) {
          await this.stockLevelsRepository.save(stockEntries);
        }
      } catch (error) {
        result.errors.push(`Batch-Fehler (Neu): ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // === BESTEHENDE ARTIKEL AKTUALISIEREN ===
    const existingCodesToLoad = toUpdate.map((n) => n.code);
    if (existingCodesToLoad.length > 0) {
      const existingItems = await this.repository.find({
        where: branchId
          ? { code: In(existingCodesToLoad), branchId }
          : { code: In(existingCodesToLoad), branchId: IsNull() },
        relations: ['codes'],
      });
      const existingByCode = new Map(existingItems.map((item) => [item.code, item]));

      for (const normalized of toUpdate) {
        const existing = existingByCode.get(normalized.code);
        if (!existing) continue;
        try {
          existing.description = normalized.description;
          existing.descriptionSecondary = normalized.descriptionSecondary;
          existing.manufacturer = normalized.manufacturer;
          existing.productGroup = normalized.productGroup;
          existing.qrCodeValue = normalized.qrCodeValue;
          existing.targetStock = normalized.targetStock;
          if (normalized.reorderPoint !== null) existing.reorderPoint = normalized.reorderPoint;
          if (normalized.minimumStock !== null) existing.minimumStock = normalized.minimumStock;
          existing.storageLocation = normalized.storageLocationId ? ({ id: normalized.storageLocationId } as any) : null;
          existing.supplier = normalized.supplierId ? ({ id: normalized.supplierId } as any) : null;
          if (normalized.price !== null) existing.price = normalized.price;
          if (normalized.packSize !== null) existing.packSize = normalized.packSize;
          if (normalized.orderQuantity !== null) existing.orderQuantity = normalized.orderQuantity;
          await this.repository.save(existing);
          result.updated += 1;
        } catch (error) {
          result.errors.push(`Update-Fehler (${normalized.code}): ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return result;
  }

  private async analyzeBulkImport(dtos: CreateItemDto[], branchId?: string | null): Promise<BulkImportAnalysis> {
    const result: BulkImportAnalysis = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      rows: [],
      normalized: [],
    };
    if (!dtos || dtos.length === 0) {
      return result;
    }

    const candidates: Array<{ row: number; code: string; dto: CreateItemDto; alternateCodes: string[] }> = [];
    const uniqueByCode = new Map<string, number>();
    const requestedAltCodes = new Set<string>();
    const requestedLocationIds = new Set<string>();
    const requestedSupplierIds = new Set<string>();

    for (let index = 0; index < dtos.length; index += 1) {
      const dto = dtos[index];
      const row = index + 1;
      const code = dto.code?.trim();
      if (!code) {
        result.errors.push(`Zeile ${row}: Artikel ohne Code uebersprungen`);
        result.rows.push({
          row,
          code: "",
          action: "ERROR",
          reason: "Code fehlt",
        });
        continue;
      }
      if (uniqueByCode.has(code)) {
        result.skipped += 1;
        result.rows.push({
          row,
          code,
          action: "SKIP",
          reason: "Duplikat in Importdatei",
        });
        continue;
      }
      uniqueByCode.set(code, row);

      const alternateCodes = sanitizeCodes(dto.alternateCodes).filter((value) => value !== code.toUpperCase());
      alternateCodes.forEach((value) => requestedAltCodes.add(value));

      const storageLocationId = dto.storageLocationId?.trim();
      if (storageLocationId) {
        requestedLocationIds.add(storageLocationId);
      }
      const supplierId = dto.supplierId?.trim();
      if (supplierId) {
        requestedSupplierIds.add(supplierId);
      }

      candidates.push({ row, code, dto, alternateCodes });
    }

    const codes = candidates.map((entry) => entry.code);
    const existingItems = codes.length
      ? await this.repository.find({
          where: branchId
            ? { code: In(codes), branchId }
            : { code: In(codes), branchId: IsNull() },
          select: ["code"],
        })
      : [];
    const existingCodes = new Set(existingItems.map((entry) => entry.code));

    const existingAltCodes = requestedAltCodes.size
      ? await this.codesRepository.find({
          where: branchId
            ? { code: In(Array.from(requestedAltCodes)), branchId }
            : { code: In(Array.from(requestedAltCodes)), branchId: IsNull() },
          select: ["code"],
        })
      : [];
    const altConflicts = new Set(existingAltCodes.map((entry) => entry.code));

    const existingLocationIds = requestedLocationIds.size
      ? await this.locationsRepository.find({
          where: branchId
            ? { id: In(Array.from(requestedLocationIds)), branchId }
            : { id: In(Array.from(requestedLocationIds)) },
          select: ["id"],
        })
      : [];
    const locationIds = new Set(existingLocationIds.map((entry) => entry.id));

    const existingSupplierIds = requestedSupplierIds.size
      ? await this.suppliersRepository.find({
          where: { id: In(Array.from(requestedSupplierIds)) },
          select: ["id"],
        })
      : [];
    const supplierIds = new Set(existingSupplierIds.map((entry) => entry.id));

    const acceptedAltCodes = new Map<string, string>();

    for (const entry of candidates) {
      const { row, code, dto, alternateCodes } = entry;

      const isUpdate = existingCodes.has(code);

      const description = dto.description?.trim();
      if (!description) {
        const message = `Zeile ${row} (${code}): Beschreibung fehlt`;
        result.errors.push(message);
        result.rows.push({ row, code, action: "ERROR", reason: "Beschreibung fehlt" });
        continue;
      }
      const manufacturer = dto.manufacturer?.trim();
      if (!manufacturer) {
        const message = `Zeile ${row} (${code}): Hersteller fehlt`;
        result.errors.push(message);
        result.rows.push({ row, code, action: "ERROR", reason: "Hersteller fehlt" });
        continue;
      }
      const productGroup = dto.productGroup?.trim();
      if (!productGroup) {
        const message = `Zeile ${row} (${code}): Warengruppe fehlt`;
        result.errors.push(message);
        result.rows.push({ row, code, action: "ERROR", reason: "Warengruppe fehlt" });
        continue;
      }

      const supplierId = dto.supplierId?.trim() || undefined;
      if (supplierId && !supplierIds.has(supplierId)) {
        const message = `Zeile ${row} (${code}): Lieferant nicht gefunden (${supplierId})`;
        result.errors.push(message);
        result.rows.push({ row, code, action: "ERROR", reason: `Lieferant unbekannt (${supplierId})` });
        continue;
      }

      const storageLocationId = dto.storageLocationId?.trim() || undefined;
      if (storageLocationId && !locationIds.has(storageLocationId)) {
        const message = `Zeile ${row} (${code}): Lagerort nicht gefunden (${storageLocationId})`;
        result.errors.push(message);
        result.rows.push({ row, code, action: "ERROR", reason: `Lagerort unbekannt (${storageLocationId})` });
        continue;
      }

      const conflictingAltDb = alternateCodes.find((value) => altConflicts.has(value));
      if (conflictingAltDb) {
        const message = `Zeile ${row} (${code}): Alternativer Code bereits vergeben (${conflictingAltDb})`;
        result.errors.push(message);
        result.rows.push({ row, code, action: "ERROR", reason: `Alternativcode bereits vergeben (${conflictingAltDb})` });
        continue;
      }

      const conflictingAltPayload = alternateCodes.find((value) => acceptedAltCodes.has(value));
      if (conflictingAltPayload) {
        const owner = acceptedAltCodes.get(conflictingAltPayload);
        const message = `Zeile ${row} (${code}): Alternativer Code doppelt im Import (${conflictingAltPayload}, bereits bei ${owner})`;
        result.errors.push(message);
        result.rows.push({ row, code, action: "ERROR", reason: `Alternativcode doppelt (${conflictingAltPayload})` });
        continue;
      }

      const targetStock = parseOptionalInt(dto.targetStock) ?? 0;
      const reorderPoint = parseOptionalInt(dto.reorderPoint) ?? null;
      const minimumStock = parseOptionalInt(dto.minimumStock) ?? null;
      const currentQuantity = parseOptionalInt(dto.currentQuantity);
      if (currentQuantity !== undefined && !storageLocationId) {
        const message = `Zeile ${row} (${code}): Ist-Bestand ohne Lagerort`;
        result.errors.push(message);
        result.rows.push({ row, code, action: "ERROR", reason: "Ist-Bestand ohne Lagerort" });
        continue;
      }

      const packSize = parseOptionalInt(dto.packSize);
      const orderQuantity = parseOptionalInt(dto.orderQuantity);
      alternateCodes.forEach((value) => acceptedAltCodes.set(value, code));

      result.normalized.push({
        row,
        code,
        isUpdate,
        description,
        descriptionSecondary: dto.descriptionSecondary?.trim() || null,
        manufacturer,
        productGroup,
        qrCodeValue: dto.qrCodeValue?.trim() || code,
        targetStock,
        reorderPoint,
        minimumStock,
        storageLocationId,
        supplierId,
        price: parseOptionalPrice(dto.price),
        packSize: packSize && packSize > 0 ? packSize : null,
        orderQuantity: orderQuantity && orderQuantity > 0 ? orderQuantity : null,
        currentQuantity,
        alternateCodes,
      });
      if (isUpdate) {
        result.updated += 1;
        result.rows.push({ row, code, action: "UPDATE", reason: null });
      } else {
        result.created += 1;
        result.rows.push({ row, code, action: "CREATE", reason: null });
      }
    }

    return result;
  }

  async update(id: string, dto: UpdateItemDto, branchId?: string | null): Promise<Item> {
    const where: Record<string, unknown> = { id };
    if (branchId) where.branchId = branchId;
    const entity = await this.repository.findOne({
      where,
      relations: ['codes', 'storageLocation', 'supplier']
    });
    if (!entity) {
      throw new NotFoundException("Item not found");
    }

    const previousLocationId = entity.storageLocation?.id ?? null;
    const { alternateCodes, storageLocationId, supplierId, price, packSize, orderQuantity, ...rest } = dto;
    Object.assign(entity, rest);
    if (rest.description !== undefined && typeof entity.description === "string") {
      entity.description = entity.description.trim();
    }
    if (rest.descriptionSecondary !== undefined) {
      const trimmed = entity.descriptionSecondary?.trim();
      entity.descriptionSecondary = trimmed && trimmed.length > 0 ? trimmed : null;
    }
    if (storageLocationId !== undefined) {
      entity.storageLocation = storageLocationId ? ({ id: storageLocationId } as any) : null;
    }
    if (supplierId !== undefined) {
      entity.supplier = supplierId ? ({ id: supplierId } as any) : null;
    }
    if (price !== undefined) {
      entity.price = Number.isFinite(Number(price)) ? Number(price).toFixed(2) : null;
    }
    if (packSize !== undefined) {
      entity.packSize = packSize as any;
    }
    if (orderQuantity !== undefined) {
      entity.orderQuantity = Number(orderQuantity) > 0 ? (orderQuantity as any) : null;
    }

    if (alternateCodes !== undefined) {
      // Lösche alle vorhandenen alternativen Codes
      if (entity.codes && entity.codes.length > 0) {
        await this.codesRepository.remove(entity.codes);
      }
      
      // Füge neue alternative Codes hinzu
      const codes = sanitizeCodes(alternateCodes);
      if (codes.length > 0) {
        // Prüfe auf Duplikate in der Datenbank – nur innerhalb der Niederlassung
        const altWhere = entity.branchId
          ? { code: In(codes), branchId: entity.branchId }
          : { code: In(codes), branchId: IsNull() };
        const existingCodes = await this.codesRepository.find({
          where: altWhere,
          relations: ["item"],
        });
        const conflict = existingCodes.find((ec) => ec.item?.id !== id);
        if (conflict) {
          throw new Error(`Alternativer Code bereits vergeben: ${conflict.code}`);
        }
        entity.codes = codes.map((code) => this.codesRepository.create({ code, branchId: entity.branchId as string }));
      } else {
        entity.codes = [];
      }
    }

    const saved = await this.repository.save(entity);
    const nextLocationId =
      storageLocationId !== undefined ? (storageLocationId || null) : previousLocationId;
    if (previousLocationId && nextLocationId && previousLocationId !== nextLocationId) {
      await this.transferItemStockLevel(saved.id, previousLocationId, nextLocationId);
    }
    return saved;
  }

  /** Bulk-Update: mehrere Artikel auf einmal aktualisieren (für Hyreka-Import) */
  async updateBulk(updates: Array<UpdateItemDto & { id: string }>, branchId?: string | null): Promise<{ updated: number; errors: string[] }> {
    let updated = 0;
    const errors: string[] = [];
    for (const { id, ...dto } of updates) {
      try {
        await this.update(id, dto, branchId);
        updated++;
      } catch (err) {
        errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { updated, errors };
  }

  private async transferItemStockLevel(itemId: string, fromLocationId: string, toLocationId: string) {
    const source = await this.stockLevelsRepository.findOne({
      where: {
        item: { id: itemId },
        location: { id: fromLocationId },
      },
    });
    if (!source) {
      return;
    }

    const target = await this.stockLevelsRepository.findOne({
      where: {
        item: { id: itemId },
        location: { id: toLocationId },
      },
    });

    if (target) {
      target.quantity += source.quantity;
      target.targetQuantity = Math.max(target.targetQuantity ?? 0, source.targetQuantity ?? 0);
      await this.stockLevelsRepository.save(target);
      await this.stockLevelsRepository.remove(source);
      return;
    }

    source.location = { id: toLocationId } as any;
    source.vehicle = null;
    await this.stockLevelsRepository.save(source);
  }

  async remove(id: string, actorId?: string, branchId?: string | null): Promise<void> {
    const where: Record<string, unknown> = { id };
    if (branchId) where.branchId = branchId;
    const item = await this.repository.findOne({ where });
    if (!item) throw new NotFoundException("Item not found");
    await this.repository.delete(id);

    // Audit-Log: Loeschvorgang protokollieren
    await this.loggingService.log(
      LogLevel.INFO,
      LogCategory.SYSTEM,
      'item_deleted',
      JSON.stringify({ itemId: id, itemCode: item?.code, itemDescription: item?.description, actorId: actorId ?? null }),
      { userId: actorId },
    );
  }

  async previewReset(branchId?: string | null): Promise<{
    items: number;
    stockLevels: number;
    stockMovements: number;
    locations: number;
  }> {
    const branchFilter = branchId ? { branchId } : { branchId: IsNull() };

    const items = await this.repository.count({ where: branchFilter });

    const stockLevels = items > 0
      ? await this.stockLevelsRepository
          .createQueryBuilder("sl")
          .innerJoin("sl.item", "item")
          .where(branchId ? "item.branchId = :branchId" : "item.branchId IS NULL", branchId ? { branchId } : {})
          .getCount()
      : 0;

    const stockMovements = items > 0
      ? await this.stockMovementsRepository
          .createQueryBuilder("sm")
          .innerJoin("sm.item", "item")
          .where(branchId ? "item.branchId = :branchId" : "item.branchId IS NULL", branchId ? { branchId } : {})
          .getCount()
      : 0;

    const locations = await this.locationsRepository
      .createQueryBuilder("loc")
      .where(branchId ? "loc.branchId = :branchId" : "loc.branchId IS NULL", branchId ? { branchId } : {})
      .andWhere("loc.type != 'VEHICLE'")
      .getCount();

    return { items, stockLevels, stockMovements, locations };
  }

  async removeAll(branchId?: string | null, includeLocations = false): Promise<{ deleted: number; locationsDeleted: number }> {
    try {
      this.logger.log("Starte removeAll-Operation");

      const branchFilter = branchId ? { branchId } : { branchId: IsNull() };
      const itemCount = await this.repository.count({ where: branchFilter });
      this.logger.log(`Gefundene Artikel vor Loeschung: ${itemCount}`);

      let itemsDeletedCount = 0;
      if (itemCount > 0) {
        // purchase_order_lines hat onDelete: RESTRICT auf item → erst Bestellpositionen
        // für alle Artikel dieses Lagers löschen, bevor die Artikel selbst gelöscht werden.
        const itemIds: { id: string }[] = await this.dataSource.query(
          branchId
            ? `SELECT id FROM items WHERE branchId = ?`
            : `SELECT id FROM items WHERE branchId IS NULL`,
          branchId ? [branchId] : [],
        );
        if (itemIds.length > 0) {
          const ids = itemIds.map((r) => r.id);
          // In Blöcken löschen um IN-Clause-Limit zu vermeiden
          const chunkSize = 500;
          for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => "?").join(",");
            await this.dataSource.query(
              `DELETE FROM purchase_order_lines WHERE itemId IN (${placeholders})`,
              chunk,
            );
          }
        }

        // Artikel-Codes löschen (raw SQL – TypeORM-DELETE-QueryBuilder unterstützt keinen Alias in WHERE)
        await this.dataSource.query(
          branchId
            ? `DELETE FROM item_codes WHERE branchId = ?`
            : `DELETE FROM item_codes WHERE branchId IS NULL`,
          branchId ? [branchId] : [],
        );

        // Artikel löschen (CASCADE löscht StockLevels, StockMovements, RestockRequests, InventoryLines)
        const itemsResult = await this.dataSource.query(
          branchId
            ? `DELETE FROM items WHERE branchId = ?`
            : `DELETE FROM items WHERE branchId IS NULL`,
          branchId ? [branchId] : [],
        );
        itemsDeletedCount = itemsResult?.affectedRows ?? 0;
        this.logger.log(`Artikel geloescht: ${itemsDeletedCount}`);
      }

      let locationsDeletedCount = 0;
      if (includeLocations) {
        // Kinder zuerst, dann Eltern – bis zu 3 Durchläufe für verschachtelte Hierarchien
        for (let pass = 0; pass < 3; pass++) {
          const locResult = await this.dataSource.query(
            branchId
              ? `DELETE FROM locations WHERE branchId = ? AND type != 'VEHICLE'`
              : `DELETE FROM locations WHERE branchId IS NULL AND type != 'VEHICLE'`,
            branchId ? [branchId] : [],
          );
          const affected: number = locResult?.affectedRows ?? 0;
          locationsDeletedCount += affected;
          if (!affected) break;
        }
        this.logger.log(`Lagerorte geloescht: ${locationsDeletedCount}`);
      }

      return { deleted: itemsDeletedCount, locationsDeleted: locationsDeletedCount };
    } catch (error) {
      this.logger.error("Fehler bei removeAll:", error);
      throw error;
    }
  }

  // ─── Artikelbild ──────────────────────────────────────────────────────────

  private get imageDir(): string {
    return process.env.ITEM_IMAGE_PATH || "/app/item-images";
  }

  async uploadImage(id: string, file: Express.Multer.File, branchId?: string | null): Promise<Item> {
    const item = await this.findOne(id, branchId);
    if (!item) throw new NotFoundException("Artikel nicht gefunden");

    await fs.mkdir(this.imageDir, { recursive: true });

    const filename = `${id}.jpg`;
    const filepath = path.join(this.imageDir, filename);

    await sharp(file.buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(filepath);

    await this.repository.update(id, { imagePath: filename });
    return this.findOne(id) as Promise<Item>;
  }

  async deleteImage(id: string, branchId?: string | null): Promise<Item> {
    const item = await this.findOne(id, branchId);
    if (!item) throw new NotFoundException("Artikel nicht gefunden");

    if (item.imagePath) {
      const filepath = path.join(this.imageDir, item.imagePath);
      await fs.unlink(filepath).catch(() => {});
      await this.repository.update(id, { imagePath: null });
    }
    return this.findOne(id) as Promise<Item>;
  }

  getImageFilePath(imagePath: string): string {
    return path.join(this.imageDir, imagePath);
  }
}
