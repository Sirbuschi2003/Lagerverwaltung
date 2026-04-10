import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";

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
  ) {}

  async getSlowMoverThreshold(branchId?: string | null): Promise<number> {
    const val = await this.systemConfigService.getJsonConfig<number>(SLOW_MOVER_DAYS_KEY, branchId);
    return typeof val === "number" && val > 0 ? val : SLOW_MOVER_DAYS_DEFAULT;
  }

  async setSlowMoverThreshold(days: number, branchId?: string | null): Promise<number> {
    await this.systemConfigService.setJsonConfig(SLOW_MOVER_DAYS_KEY, days, branchId, "Slow-Mover Schwellwert in Tagen");
    return days;
  }

  async slowMoverReport(thresholdDays: number, branchId?: string | null): Promise<SlowMoverRow[]> {
    // Aggregiere Bestand pro Artikel
    const levelsQb = this.stockLevelsRepository
      .createQueryBuilder("level")
      .select("level.itemId", "itemId")
      .addSelect("SUM(level.quantity)", "totalQuantity")
      .leftJoin("level.item", "item");

    if (branchId) {
      levelsQb.where("item.branchId = :branchId", { branchId });
    }
    levelsQb.groupBy("level.itemId").having("SUM(level.quantity) >= 0");

    const levels: Array<{ itemId: string; totalQuantity: string }> = await levelsQb.getRawMany();

    if (levels.length === 0) return [];

    const itemIds = levels.map((l) => l.itemId);

    // Letzten Bewegungszeitpunkt pro Artikel
    const lastMovementMap = new Map<string, Date>();
    const lastMovementsRaw: Array<{ itemId: string; lastAt: string }> = await this.movementsRepository
      .createQueryBuilder("mv")
      .select("mv.itemId", "itemId")
      .addSelect("MAX(mv.occurredAt)", "lastAt")
      .where("mv.itemId IN (:...itemIds)", { itemIds })
      .andWhere("mv.isVoided = false")
      .groupBy("mv.itemId")
      .getRawMany();

    lastMovementsRaw.forEach((row) => {
      lastMovementMap.set(row.itemId, new Date(row.lastAt));
    });

    // Artikel-Stammdaten
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

      // Slow-Mover: keine Bewegung seit > thresholdDays oder noch nie bewegt
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

  async consumptionReport(from: Date, to: Date, branchId?: string | null) {
    if (!branchId) {
      return this.movementsRepository.find({
        where: { occurredAt: Between(from, to) },
        order: { occurredAt: "ASC" },
      });
    }
    return this.movementsRepository
      .createQueryBuilder("movement")
      .leftJoin("movement.item", "item")
      .where("movement.occurredAt BETWEEN :from AND :to", { from, to })
      .andWhere("item.branchId = :branchId", { branchId })
      .orderBy("movement.occurredAt", "ASC")
      .getMany();
  }

  async stockStatusSummary(branchId?: string | null) {
    if (!branchId) {
      return this.stockLevelsRepository.find({
        order: { vehicle: { licensePlate: "ASC" } },
      });
    }
    return this.stockLevelsRepository
      .createQueryBuilder("level")
      .leftJoin("level.item", "item")
      .where("item.branchId = :branchId", { branchId })
      .orderBy("level.vehicleId", "ASC")
      .getMany();
  }

  async consumptionTrend(months: 6 | 12, branchId?: string | null): Promise<Array<{ month: string; checkouts: number; checkins: number }>> {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const qb = this.movementsRepository
      .createQueryBuilder("mv")
      .select("DATE_FORMAT(mv.occurredAt, '%Y-%m')", "month")
      .addSelect("SUM(CASE WHEN mv.type = 'CHECKOUT' THEN mv.quantity ELSE 0 END)", "checkouts")
      .addSelect("SUM(CASE WHEN mv.type = 'CHECKIN' THEN mv.quantity ELSE 0 END)", "checkins")
      .where("mv.occurredAt >= :from", { from })
      .andWhere("mv.isVoided = false")
      .groupBy("month")
      .orderBy("month", "ASC");

    if (branchId) {
      qb.leftJoin("mv.item", "item").andWhere("item.branchId = :branchId", { branchId });
    }

    const raw: Array<{ month: string; checkouts: string; checkins: string }> = await qb.getRawMany();

    // Alle Monate auffüllen (auch Monate ohne Bewegungen)
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
