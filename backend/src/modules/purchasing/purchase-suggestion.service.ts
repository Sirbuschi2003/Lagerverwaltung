import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { LocationsService } from "../locations/locations.service";
import { Location } from "../locations/entities/location.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { Item } from "../items/entities/item.entity";
import { PurchaseOrderLine } from "./entities/purchase-order-line.entity";

@Injectable()
export class PurchaseSuggestionService {
  private suggestionsCacheMap = new Map<string, { data: unknown[]; timestamp: number }>();
  private readonly SUGGESTIONS_CACHE_TTL = 10_000;
  private readonly MAX_CACHE_SIZE = 100;

  constructor(
    @InjectRepository(StockLevel)
    private readonly stockLevelsRepository: Repository<StockLevel>,
    @InjectRepository(PurchaseOrderLine)
    private readonly linesRepository: Repository<PurchaseOrderLine>,
    @InjectRepository(Item)
    private readonly itemsRepository: Repository<Item>,
    private readonly locationsService: LocationsService,
    private readonly dataSource: DataSource,
  ) {}

  invalidateSuggestionsCache() {
    this.suggestionsCacheMap.clear();
  }

  async getSuggestions(branchId: string | null | undefined, refresh = false, locationIds?: string[], warehouseId?: string) {
    const effectiveLocationIds = warehouseId ? [warehouseId] : locationIds;
    const cacheKey = (branchId ?? "ALL") + (warehouseId ? `_w:${warehouseId}` : effectiveLocationIds?.length ? `_${effectiveLocationIds.sort().join(",")}` : "");
    const now = Date.now();
    const cached = this.suggestionsCacheMap.get(cacheKey);
    if (!refresh && cached && (now - cached.timestamp) < this.SUGGESTIONS_CACHE_TTL) {
      return cached.data;
    }

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

    let itemEntities: Item[];
    if (effectiveLocationIds?.length) {
      const qb = this.itemsRepository
        .createQueryBuilder("item")
        .leftJoinAndSelect("item.storageLocation", "storageLocation")
        .leftJoin("storageLocation.parent", "slParent")
        .leftJoin("slParent.parent", "slGrandparent")
        .leftJoinAndSelect("item.supplier", "supplier")
        .where("item.targetStock > 0");
      if (branchId) qb.andWhere("item.branchId = :branchId", { branchId });
      qb.andWhere(
        "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds) OR slGrandparent.id IN (:...locationIds))",
        { locationIds: effectiveLocationIds },
      );
      itemEntities = await qb.getMany();
    } else {
      const qb = this.itemsRepository
        .createQueryBuilder("item")
        .innerJoinAndSelect("item.storageLocation", "storageLocation")
        .leftJoin("storageLocation.parent", "slParent")
        .leftJoinAndSelect("item.supplier", "supplier")
        .where("item.targetStock > 0");
      if (branchId) qb.andWhere("item.branchId = :branchId", { branchId });
      itemEntities = await qb.getMany();
    }

    const allLocations = await this.locationsService.findAll({ includeVehicles: true, branchId: branchId ?? undefined });
    const defaultWarehouse = allLocations.find((location) => location.type === "WAREHOUSE") ?? null;
    const locationById = new Map<string, Location>();
    allLocations.forEach((location) => locationById.set(location.id, location));

    const itemIds = itemEntities.map((item) => item.id);
    const stockLevelsQb = itemIds.length
      ? this.stockLevelsRepository
          .createQueryBuilder("sl")
          .leftJoinAndSelect("sl.item", "item")
          .leftJoinAndSelect("sl.location", "location")
          .leftJoin("location.parent", "locParent")
          .leftJoin("locParent.parent", "locGrandparent")
          .where("sl.itemId IN (:...itemIds)", { itemIds })
          .andWhere("sl.vehicleId IS NULL")
      : null;
    if (stockLevelsQb && effectiveLocationIds?.length) {
      stockLevelsQb.andWhere(
        "(location.id IS NULL OR location.id IN (:...locationIds) OR locParent.id IN (:...locationIds) OR locGrandparent.id IN (:...locationIds))",
        { locationIds: effectiveLocationIds },
      );
    }
    const stockLevels = stockLevelsQb ? await stockLevelsQb.getMany() : [];
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
      incomingQuantity: number;
      neededQuantity: number;
      availableInOtherBranches: Array<{ branchId: string; branchName: string; quantity: number }>;
      consumptionRates: { d30: number; d60: number; d90: number; d180: number; d365: number };
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
      const legacyUnassignedLevel = itemStockLevels.find((entry) => !entry.location?.id && !entry.vehicle?.id);
      const currentQuantity = Number(level?.quantity ?? legacyUnassignedLevel?.quantity ?? 0);
      const incomingQuantity = incomingByItem.get(item.id) ?? 0;

      const reorderPoint = item.reorderPoint != null ? Number(item.reorderPoint) : null;
      const triggerOrder =
        reorderPoint != null
          ? currentQuantity + incomingQuantity <= reorderPoint
          : currentQuantity + incomingQuantity < target;
      if (!triggerOrder) continue;

      const rawNeeded = Math.max(0, target - currentQuantity - incomingQuantity);
      if (rawNeeded <= 0) continue;

      const packSize = item.packSize != null && item.packSize > 1 ? item.packSize : 1;
      const needed = Math.ceil(rawNeeded / packSize) * packSize;

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
        incomingQuantity,
        neededQuantity: needed,
        availableInOtherBranches: [],
        consumptionRates: { d30: 0, d60: 0, d90: 0, d180: 0, d365: 0 },
      });
    }

    if (suggestions.length > 0) {
      const suggestionItemIds = suggestions.map((s) => s.itemId);
      const rateRows: Array<{
        itemId: string;
        qty30: string; qty60: string; qty90: string; qty180: string; qty365: string;
      }> = await this.dataSource.query(
        `SELECT
          mv.itemId,
          SUM(CASE WHEN mv.occurredAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN mv.quantity ELSE 0 END) AS qty30,
          SUM(CASE WHEN mv.occurredAt >= DATE_SUB(NOW(), INTERVAL 60 DAY) THEN mv.quantity ELSE 0 END) AS qty60,
          SUM(CASE WHEN mv.occurredAt >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN mv.quantity ELSE 0 END) AS qty90,
          SUM(CASE WHEN mv.occurredAt >= DATE_SUB(NOW(), INTERVAL 180 DAY) THEN mv.quantity ELSE 0 END) AS qty180,
          SUM(mv.quantity) AS qty365
        FROM stock_movements mv
        WHERE mv.itemId IN (?)
          AND mv.type = 'CHECKOUT'
          AND mv.isVoided = 0
          AND mv.vehicleId IS NULL
          AND mv.occurredAt >= DATE_SUB(NOW(), INTERVAL 365 DAY)
          AND mv.source NOT LIKE '%import%'
        GROUP BY mv.itemId`,
        [suggestionItemIds],
      );
      const rateMap = new Map(rateRows.map((r) => [r.itemId, r]));
      for (const suggestion of suggestions) {
        const row = rateMap.get(suggestion.itemId);
        suggestion.consumptionRates = {
          d30: row ? Math.round((Number(row.qty30) / 30) * 1000) / 1000 : 0,
          d60: row ? Math.round((Number(row.qty60) / 60) * 1000) / 1000 : 0,
          d90: row ? Math.round((Number(row.qty90) / 90) * 1000) / 1000 : 0,
          d180: row ? Math.round((Number(row.qty180) / 180) * 1000) / 1000 : 0,
          d365: row ? Math.round((Number(row.qty365) / 365) * 1000) / 1000 : 0,
        };
      }
    }

    if (branchId && suggestions.length > 0) {
      const codes = suggestions.map((s) => s.code);
      const crossBranchMap = await this.getCrossBranchAvailability(codes, branchId);
      for (const suggestion of suggestions) {
        suggestion.availableInOtherBranches = crossBranchMap.get(suggestion.code) ?? [];
      }
    }

    this.suggestionsCacheMap.set(cacheKey, { data: suggestions, timestamp: Date.now() });
    if (this.suggestionsCacheMap.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.suggestionsCacheMap.keys().next().value;
      if (firstKey !== undefined) {
        this.suggestionsCacheMap.delete(firstKey);
      }
    }
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
    if (stockLocationId) return stockLocationId;

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
    if (candidateLocationId === parentLocationId) return true;
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

  private async getCrossBranchAvailability(
    codes: string[],
    currentBranchId: string,
  ): Promise<Map<string, Array<{ branchId: string; branchName: string; quantity: number }>>> {
    const result = new Map<string, Array<{ branchId: string; branchName: string; quantity: number }>>();
    if (codes.length === 0) return result;

    const rows = await this.itemsRepository
      .createQueryBuilder("item")
      .innerJoin("item.branch", "branch")
      .leftJoin("stock_levels", "sl", "sl.itemId = item.id AND sl.vehicleId IS NULL")
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
}
