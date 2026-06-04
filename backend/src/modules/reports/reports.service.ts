import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { LocationsService } from "../locations/locations.service";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { SystemConfigService } from "../system-config/system-config.service";

export interface ForecastRow {
  itemId: string;
  code: string;
  description: string;
  descriptionSecondary: string | null;
  manufacturer: string | null;
  productGroup: string | null;
  analysisDays: number;
  totalConsumed: number;
  avgDailyConsumption: number;
  forecastQty: number;
  currentStock: number;
  deficit: number;
  daysUntilEmpty: number | null;
  reorderPoint: number | null;
  targetStock: number | null;
  minimumStock: number | null;
}

export interface SlowMoverRow {
  itemId: string;
  code: string;
  description: string;
  descriptionSecondary: string | null;
  manufacturer: string | null;
  productGroup: string | null;
  totalQuantity: number;
  lastMovementAt: string | null;
  daysSinceLastMovement: number | null;
}

export interface ArticleActivityRow {
  itemId: string;
  code: string;
  description: string;
  descriptionSecondary: string | null;
  manufacturer: string | null;
  productGroup: string | null;
  checkoutCount: number;
  checkinCount: number;
  checkoutQty: number;
  checkinQty: number;
  lastMovementAt: string | null;
}

const SLOW_MOVER_DAYS_KEY = "reports.slowMoverDays";
const SLOW_MOVER_DAYS_DEFAULT = 90;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly movementsRepository: Repository<StockMovement>,
    @InjectRepository(StockLevel)
    private readonly stockLevelsRepository: Repository<StockLevel>,
    private readonly systemConfigService: SystemConfigService,
    private readonly locationsService: LocationsService,
  ) {}

  private async resolveLocationIds(
    warehouseId?: string,
    fallbackLocationIds?: string[],
    branchId?: string | null,
  ): Promise<string[] | undefined> {
    if (warehouseId) {
      return this.locationsService.getDescendantLocationIds(warehouseId, branchId);
    }
    return fallbackLocationIds;
  }

  async getSlowMoverThreshold(branchId?: string | null): Promise<number> {
    const val = await this.systemConfigService.getJsonConfig<number>(SLOW_MOVER_DAYS_KEY, branchId);
    return typeof val === "number" && val > 0 ? val : SLOW_MOVER_DAYS_DEFAULT;
  }

  async setSlowMoverThreshold(days: number, branchId?: string | null): Promise<number> {
    await this.systemConfigService.setJsonConfig(SLOW_MOVER_DAYS_KEY, days, branchId, "Slow-Mover Schwellwert in Tagen");
    return days;
  }

  async slowMoverReport(thresholdDays: number, branchId?: string | null, locationIds?: string[], warehouseId?: string, includeVehicleMovements = false): Promise<SlowMoverRow[]> {
    const effectiveLocationIds = await this.resolveLocationIds(warehouseId, locationIds, branchId);
    const levelsQb = this.stockLevelsRepository
      .createQueryBuilder("level")
      .select("level.itemId", "itemId")
      .addSelect("SUM(level.quantity)", "totalQuantity")
      .leftJoin("level.item", "item")
      .leftJoin("item.storageLocation", "storageLocation")
      .leftJoin("storageLocation.parent", "slParent");

    if (branchId) {
      levelsQb.where("item.branchId = :branchId", { branchId });
    }

    if (effectiveLocationIds?.length) {
      levelsQb.andWhere(
        "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))",
        { locationIds: effectiveLocationIds },
      );
    }

    if (!includeVehicleMovements) {
      levelsQb.andWhere("level.vehicleId IS NULL").andWhere("level.locationId IS NOT NULL");
    } else if (branchId) {
      levelsQb.leftJoin("level.vehicle", "vehicle")
        .andWhere("(level.vehicleId IS NULL OR vehicle.branchId = :branchId)", { branchId })
        .andWhere("(level.vehicleId IS NOT NULL OR level.locationId IS NOT NULL)");
    }

    levelsQb.groupBy("level.itemId").having("SUM(level.quantity) >= 0");

    const levels: Array<{ itemId: string; totalQuantity: string }> = await levelsQb.getRawMany();
    if (levels.length === 0) return [];

    const itemIds = levels.map((l) => l.itemId);

    const lastMovementMap = new Map<string, Date>();
    const lastMovementsRaw: Array<{ itemId: string; lastAt: string }> = await this.movementsRepository
      .createQueryBuilder("mv")
      .select("mv.itemId", "itemId")
      .addSelect("MAX(mv.occurredAt)", "lastAt")
      .where("mv.itemId IN (:...itemIds)", { itemIds })
      .andWhere("mv.isVoided = false")
      .andWhere("mv.source NOT LIKE :importPattern", { importPattern: "%import%" })
      .groupBy("mv.itemId")
      .getRawMany();

    lastMovementsRaw.forEach((row) => {
      lastMovementMap.set(row.itemId, new Date(row.lastAt));
    });

    const itemDetailsRaw: Array<{
      id: string; code: string; description: string;
      descriptionSecondary: string | null; manufacturer: string | null; productGroup: string | null;
    }> = await this.movementsRepository.manager
      .createQueryBuilder()
      .select(["item.id AS id", "item.code AS code", "item.description AS description",
        "item.descriptionSecondary AS descriptionSecondary",
        "item.manufacturer AS manufacturer", "item.productGroup AS productGroup"])
      .from("items", "item")
      .where("item.id IN (:...itemIds)", { itemIds })
      .getRawMany();

    const itemMap = new Map(itemDetailsRaw.map((i) => [i.id, i]));

    const now = Date.now();
    const cutoff = now - thresholdDays * 24 * 60 * 60 * 1000;

    const rows: SlowMoverRow[] = [];
    for (const level of levels) {
      const lastAt = lastMovementMap.get(level.itemId) ?? null;
      const daysSince = lastAt ? Math.floor((now - lastAt.getTime()) / (24 * 60 * 60 * 1000)) : null;

      if (lastAt !== null && lastAt.getTime() >= cutoff) continue;

      const item = itemMap.get(level.itemId);
      if (!item) continue;

      rows.push({
        itemId: level.itemId,
        code: item.code,
        description: item.description,
        descriptionSecondary: item.descriptionSecondary ?? null,
        manufacturer: item.manufacturer ?? null,
        productGroup: item.productGroup ?? null,
        totalQuantity: Number(level.totalQuantity),
        lastMovementAt: lastAt ? lastAt.toISOString() : null,
        daysSinceLastMovement: daysSince,
      });
    }

    return rows.sort((a, b) => {
      if (a.daysSinceLastMovement === null) return -1;
      if (b.daysSinceLastMovement === null) return 1;
      return b.daysSinceLastMovement - a.daysSinceLastMovement;
    });
  }

  async consumptionReport(from: Date, to: Date, branchId?: string | null, locationIds?: string[], warehouseId?: string, includeVehicleMovements = false) {
    const effectiveLocationIds = await this.resolveLocationIds(warehouseId, locationIds, branchId);
    const excludeVehicles = effectiveLocationIds?.length && !includeVehicleMovements;
    const qb = this.movementsRepository
      .createQueryBuilder("movement")
      .leftJoin("movement.item", "item")
      .leftJoin("item.storageLocation", "storageLocation")
      .leftJoin("storageLocation.parent", "slParent")
      .where("movement.occurredAt BETWEEN :from AND :to", { from, to })
      .andWhere("movement.isVoided = false")
      .andWhere("movement.source NOT LIKE :importPattern", { importPattern: "%import%" })
      .orderBy("movement.occurredAt", "ASC");

    if (branchId) {
      qb.andWhere("item.branchId = :branchId", { branchId });
    }

    if (effectiveLocationIds?.length) {
      qb.andWhere(
        "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))",
        { locationIds: effectiveLocationIds },
      );
    }
    if (excludeVehicles) {
      qb.andWhere("movement.vehicleId IS NULL");
    } else if (branchId) {
      qb.leftJoin("movement.vehicle", "moveVehicle")
        .andWhere("(movement.vehicleId IS NULL OR moveVehicle.branchId = :branchId)", { branchId });
    }

    return qb.getMany();
  }

  async stockStatusSummary(branchId?: string | null, locationIds?: string[], includeVehicleMovements = false) {
    const qb = this.stockLevelsRepository
      .createQueryBuilder("level")
      .leftJoin("level.item", "item")
      .leftJoin("item.storageLocation", "storageLocation")
      .leftJoin("storageLocation.parent", "slParent")
      .orderBy("level.vehicleId", "ASC");

    if (branchId) {
      qb.andWhere("item.branchId = :branchId", { branchId });
    }

    if (locationIds?.length) {
      qb.andWhere(
        "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))",
        { locationIds },
      );
    }

    if (!includeVehicleMovements) {
      qb.andWhere("level.vehicleId IS NULL").andWhere("level.locationId IS NOT NULL");
    } else if (branchId) {
      qb.leftJoin("level.vehicle", "vehicle")
        .andWhere("(level.vehicleId IS NULL OR vehicle.branchId = :branchId)", { branchId })
        .andWhere("(level.vehicleId IS NOT NULL OR level.locationId IS NOT NULL)");
    }

    return qb.getMany();
  }

  async consumptionTrend(
    months: 6 | 12,
    branchId?: string | null,
    itemId?: string | null,
    locationIds?: string[],
    warehouseId?: string,
    includeVehicleMovements = false,
  ): Promise<Array<{ month: string; checkouts: number; checkins: number }>> {
    const effectiveLocationIds = await this.resolveLocationIds(warehouseId, locationIds, branchId);
    const excludeVehicles = effectiveLocationIds?.length && !includeVehicleMovements;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const qb = this.movementsRepository
      .createQueryBuilder("mv")
      .select("DATE_FORMAT(mv.occurredAt, '%Y-%m')", "month")
      .addSelect("SUM(CASE WHEN mv.type = 'CHECKOUT' THEN mv.quantity ELSE 0 END)", "checkouts")
      .addSelect("SUM(CASE WHEN mv.type = 'CHECKIN' THEN mv.quantity ELSE 0 END)", "checkins")
      .where("mv.occurredAt >= :from", { from })
      .andWhere("mv.isVoided = false")
      .andWhere("mv.source NOT LIKE :importPattern", { importPattern: "%import%" })
      .groupBy("month")
      .orderBy("month", "ASC");

    if (excludeVehicles) {
      qb.andWhere("mv.vehicleId IS NULL");
    } else if (branchId) {
      qb.leftJoin("mv.vehicle", "trendVehicle")
        .andWhere("(mv.vehicleId IS NULL OR trendVehicle.branchId = :branchId)", { branchId });
    }

    if (branchId || itemId || effectiveLocationIds?.length) {
      qb.leftJoin("mv.item", "item");
      if (branchId) qb.andWhere("item.branchId = :branchId", { branchId });
      if (itemId) qb.andWhere("mv.itemId = :itemId", { itemId });
      if (effectiveLocationIds?.length) {
        qb.leftJoin("item.storageLocation", "storageLocation")
          .leftJoin("storageLocation.parent", "slParent")
          .andWhere(
            "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))",
            { locationIds: effectiveLocationIds },
          );
      }
    }

    const raw: Array<{ month: string; checkouts: string; checkins: string }> = await qb.getRawMany();

    const result: Array<{ month: string; checkouts: number; checkins: number }> = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const found = raw.find((r) => r.month === key);
      result.push({
        month: key,
        checkouts: found ? Number(found.checkouts) : 0,
        checkins: found ? Number(found.checkins) : 0,
      });
    }
    return result;
  }

  async articleActivityReport(
    from: Date,
    to: Date,
    branchId?: string | null,
    locationIds?: string[],
    warehouseId?: string,
    includeVehicleMovements = false,
  ): Promise<ArticleActivityRow[]> {
    const effectiveLocationIds = await this.resolveLocationIds(warehouseId, locationIds, branchId);
    const excludeVehicles = effectiveLocationIds?.length && !includeVehicleMovements;
    const qb = this.movementsRepository
      .createQueryBuilder("mv")
      .select("mv.itemId", "itemId")
      .addSelect("SUM(CASE WHEN mv.type = 'CHECKOUT' THEN 1 ELSE 0 END)", "checkoutCount")
      .addSelect("SUM(CASE WHEN mv.type = 'CHECKIN' THEN 1 ELSE 0 END)", "checkinCount")
      .addSelect("SUM(CASE WHEN mv.type = 'CHECKOUT' THEN mv.quantity ELSE 0 END)", "checkoutQty")
      .addSelect("SUM(CASE WHEN mv.type = 'CHECKIN' THEN mv.quantity ELSE 0 END)", "checkinQty")
      .addSelect("MAX(mv.occurredAt)", "lastMovementAt")
      .leftJoin("mv.item", "item")
      .leftJoin("item.storageLocation", "storageLocation")
      .leftJoin("storageLocation.parent", "slParent")
      .where("mv.occurredAt BETWEEN :from AND :to", { from, to })
      .andWhere("mv.isVoided = false")
      .andWhere("mv.source NOT LIKE :importPattern", { importPattern: "%import%" })
      .groupBy("mv.itemId");

    if (branchId) {
      qb.andWhere("item.branchId = :branchId", { branchId });
    }

    if (effectiveLocationIds?.length) {
      qb.andWhere(
        "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))",
        { locationIds: effectiveLocationIds },
      );
    }
    if (excludeVehicles) {
      qb.andWhere("mv.vehicleId IS NULL");
    } else if (branchId) {
      qb.leftJoin("mv.vehicle", "actVehicle")
        .andWhere("(mv.vehicleId IS NULL OR actVehicle.branchId = :branchId)", { branchId });
    }

    const raw: Array<{
      itemId: string;
      checkoutCount: string;
      checkinCount: string;
      checkoutQty: string;
      checkinQty: string;
      lastMovementAt: string;
    }> = await qb.getRawMany();

    if (raw.length === 0) return [];

    const itemIds = raw.map((r) => r.itemId);
    const itemDetailsRaw: Array<{
      id: string; code: string; description: string;
      descriptionSecondary: string | null; manufacturer: string | null; productGroup: string | null;
    }> = await this.movementsRepository.manager
      .createQueryBuilder()
      .select(["item.id AS id", "item.code AS code", "item.description AS description",
        "item.descriptionSecondary AS descriptionSecondary",
        "item.manufacturer AS manufacturer", "item.productGroup AS productGroup"])
      .from("items", "item")
      .where("item.id IN (:...itemIds)", { itemIds })
      .getRawMany();

    const itemMap = new Map(itemDetailsRaw.map((i) => [i.id, i]));

    return raw
      .map((r) => {
        const item = itemMap.get(r.itemId);
        if (!item) return null;
        return {
          itemId: r.itemId,
          code: item.code,
          description: item.description,
          descriptionSecondary: item.descriptionSecondary ?? null,
          manufacturer: item.manufacturer ?? null,
          productGroup: item.productGroup ?? null,
          checkoutCount: Number(r.checkoutCount),
          checkinCount: Number(r.checkinCount),
          checkoutQty: Number(r.checkoutQty),
          checkinQty: Number(r.checkinQty),
          lastMovementAt: r.lastMovementAt ? new Date(r.lastMovementAt).toISOString() : null,
        } satisfies ArticleActivityRow;
      })
      .filter((r): r is ArticleActivityRow => r !== null)
      .sort((a, b) => (b.checkoutCount + b.checkinCount) - (a.checkoutCount + a.checkinCount));
  }

  async forecastReport(
    forecastDays: number,
    branchId?: string | null,
    locationIds?: string[],
    warehouseId?: string,
    includeVehicleMovements = false,
  ): Promise<ForecastRow[]> {
    const effectiveLocationIds = await this.resolveLocationIds(warehouseId, locationIds, branchId);
    const now = new Date();
    const analysisFrom = new Date(now.getTime() - forecastDays * 24 * 60 * 60 * 1000);

    // Verbrauch (CHECKOUT) im Analysezeitraum pro Artikel
    const consumptionQb = this.movementsRepository
      .createQueryBuilder("mv")
      .select("mv.itemId", "itemId")
      .addSelect("SUM(mv.quantity)", "totalConsumed")
      .leftJoin("mv.item", "item")
      .leftJoin("item.storageLocation", "storageLocation")
      .leftJoin("storageLocation.parent", "slParent")
      .where("mv.occurredAt >= :analysisFrom", { analysisFrom })
      .andWhere("mv.type = 'CHECKOUT'")
      .andWhere("mv.isVoided = false")
      .andWhere("mv.source NOT LIKE :importPattern", { importPattern: "%import%" })
      .groupBy("mv.itemId");

    if (branchId) consumptionQb.andWhere("item.branchId = :branchId", { branchId });
    if (effectiveLocationIds?.length) {
      consumptionQb.andWhere(
        "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))",
        { locationIds: effectiveLocationIds },
      );
    }
    if (!includeVehicleMovements) {
      consumptionQb.andWhere("mv.vehicleId IS NULL");
    } else if (branchId) {
      consumptionQb.leftJoin("mv.vehicle", "mvVehicle")
        .andWhere("(mv.vehicleId IS NULL OR mvVehicle.branchId = :branchId)", { branchId });
    }

    const consumptionRaw: Array<{ itemId: string; totalConsumed: string }> = await consumptionQb.getRawMany();

    // Aktueller Bestand pro Artikel — nur Lagerbestand (vehicleId IS NULL), damit er mit der Artikelseite übereinstimmt.
    // Bei includeVehicleMovements=true wird Fahrzeugbestand einbezogen, jedoch nur von Fahrzeugen der eigenen Niederlassung.
    const stockQb = this.stockLevelsRepository
      .createQueryBuilder("level")
      .select("level.itemId", "itemId")
      .addSelect("SUM(level.quantity)", "currentStock")
      .leftJoin("level.item", "item")
      .leftJoin("item.storageLocation", "storageLocation")
      .leftJoin("storageLocation.parent", "slParent");

    if (branchId) stockQb.andWhere("item.branchId = :branchId", { branchId });
    if (effectiveLocationIds?.length) {
      stockQb.andWhere(
        "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))",
        { locationIds: effectiveLocationIds },
      );
    }
    if (!includeVehicleMovements) {
      // Nur echte Lagerort-Bestände — vehicleId=null UND locationId IS NOT NULL schließt
      // Geister-Datensätze aus (MySQL erlaubt mehrere (itemId, NULL)-Einträge in UNIQUE-Constraints)
      stockQb.andWhere("level.vehicleId IS NULL").andWhere("level.locationId IS NOT NULL");
    } else if (branchId) {
      stockQb.leftJoin("level.vehicle", "vehicle")
        .andWhere("(level.vehicleId IS NULL OR vehicle.branchId = :branchId)", { branchId })
        .andWhere("(level.vehicleId IS NOT NULL OR level.locationId IS NOT NULL)");
    }
    stockQb.groupBy("level.itemId");

    const stockRaw: Array<{ itemId: string; currentStock: string }> = await stockQb.getRawMany();

    const allItemIds = [...new Set([...consumptionRaw.map((r) => r.itemId), ...stockRaw.map((r) => r.itemId)])];
    if (allItemIds.length === 0) return [];

    const itemDetailsRaw: Array<{
      id: string; code: string; description: string;
      descriptionSecondary: string | null; manufacturer: string | null; productGroup: string | null;
      targetStock: string | null; minimumStock: string | null; reorderPoint: string | null;
    }> = await this.movementsRepository.manager
      .createQueryBuilder()
      .select([
        "item.id AS id", "item.code AS code", "item.description AS description",
        "item.descriptionSecondary AS descriptionSecondary",
        "item.manufacturer AS manufacturer", "item.productGroup AS productGroup",
        "item.targetStock AS targetStock", "item.minimumStock AS minimumStock",
        "item.reorderPoint AS reorderPoint",
      ])
      .from("items", "item")
      .where("item.id IN (:...itemIds)", { itemIds: allItemIds })
      .getRawMany();

    const itemMap = new Map(itemDetailsRaw.map((i) => [i.id, i]));
    const consumptionMap = new Map(consumptionRaw.map((r) => [r.itemId, Number(r.totalConsumed)]));
    const stockMap = new Map(stockRaw.map((r) => [r.itemId, Number(r.currentStock)]));

    const rows: ForecastRow[] = [];
    for (const itemId of allItemIds) {
      const item = itemMap.get(itemId);
      if (!item) continue;

      const totalConsumed = consumptionMap.get(itemId) ?? 0;
      const currentStock = Math.max(0, stockMap.get(itemId) ?? 0);

      if (totalConsumed === 0 && currentStock === 0) continue;

      const avgDailyConsumption = Math.round((totalConsumed / forecastDays) * 100) / 100;
      const forecastQty = totalConsumed; // Verbrauch im gleichen Zeitraum = Prognose
      const deficit = Math.max(0, forecastQty - currentStock);
      const daysUntilEmpty = avgDailyConsumption > 0 ? Math.floor(currentStock / avgDailyConsumption) : null;

      rows.push({
        itemId,
        code: item.code,
        description: item.description,
        descriptionSecondary: item.descriptionSecondary ?? null,
        manufacturer: item.manufacturer ?? null,
        productGroup: item.productGroup ?? null,
        analysisDays: forecastDays,
        totalConsumed,
        avgDailyConsumption,
        forecastQty,
        currentStock,
        deficit,
        daysUntilEmpty,
        reorderPoint: item.reorderPoint != null ? Number(item.reorderPoint) : null,
        targetStock: item.targetStock != null ? Number(item.targetStock) : null,
        minimumStock: item.minimumStock != null ? Number(item.minimumStock) : null,
      });
    }

    return rows.sort((a, b) => {
      if (b.deficit !== a.deficit) return b.deficit - a.deficit;
      if (a.daysUntilEmpty === null && b.daysUntilEmpty === null) return 0;
      if (a.daysUntilEmpty === null) return 1;
      if (b.daysUntilEmpty === null) return -1;
      return a.daysUntilEmpty - b.daysUntilEmpty;
    });
  }

  async getVehicleStockLevels(vehicleId: string, branchId?: string | null) {
    const qb = this.stockLevelsRepository
      .createQueryBuilder("sl")
      .leftJoinAndSelect("sl.item", "item")
      .leftJoinAndSelect("sl.vehicle", "vehicle")
      .where("vehicle.id = :vehicleId", { vehicleId });
    if (branchId) {
      qb.andWhere("vehicle.branchId = :branchId", { branchId });
    }
    qb.orderBy("item.productGroup", "ASC")
      .addOrderBy("item.manufacturer", "ASC")
      .addOrderBy("item.description", "ASC");
    return qb.getMany();
  }
}
