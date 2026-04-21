import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { LocationsService } from "../locations/locations.service";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { SystemConfigService } from "../system-config/system-config.service";

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

  async slowMoverReport(thresholdDays: number, branchId?: string | null, locationIds?: string[], warehouseId?: string): Promise<SlowMoverRow[]> {
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

  async consumptionReport(from: Date, to: Date, branchId?: string | null, locationIds?: string[], warehouseId?: string) {
    const effectiveLocationIds = await this.resolveLocationIds(warehouseId, locationIds, branchId);
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

    return qb.getMany();
  }

  async stockStatusSummary(branchId?: string | null, locationIds?: string[]) {
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

    return qb.getMany();
  }

  async consumptionTrend(
    months: 6 | 12,
    branchId?: string | null,
    itemId?: string | null,
    locationIds?: string[],
    warehouseId?: string,
  ): Promise<Array<{ month: string; checkouts: number; checkins: number }>> {
    const effectiveLocationIds = await this.resolveLocationIds(warehouseId, locationIds, branchId);
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
  ): Promise<ArticleActivityRow[]> {
    const effectiveLocationIds = await this.resolveLocationIds(warehouseId, locationIds, branchId);
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

  async getVehicleStockLevels(vehicleId: string) {
    return this.stockLevelsRepository.find({
      where: { vehicle: { id: vehicleId } },
      relations: { item: true, vehicle: true },
      order: {
        item: { productGroup: "ASC", manufacturer: "ASC", description: "ASC" },
      },
    });
  }
}
