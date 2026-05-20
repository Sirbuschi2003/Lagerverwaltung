import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, DataSource, LessThan } from "typeorm";
import { RestockRequest } from "../stock/entities/restock-request.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { SystemConfig } from "../logging/entities/system-config.entity";

export interface DbTableStat {
  tableName: string;
  rows: number;
  dataMb: number;
  indexMb: number;
  totalMb: number;
}

export interface DbStats {
  databaseName: string;
  totalMb: number;
  tables: DbTableStat[];
  retrievedAt: string;
}

export interface MaintenanceIssue {
  type: string;
  severity: "error" | "warning";
  count: number;
  description: string;
}

const MOVEMENT_RETENTION_KEY = "movement.retentionDays";
const MOVEMENT_RETENTION_DEFAULT = 3650; // 10 Jahre

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private cleanupTimeout: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(RestockRequest)
    private readonly restockRepo: Repository<RestockRequest>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepo: Repository<StockLevel>,
    @InjectRepository(StockMovement)
    private readonly movementRepo: Repository<StockMovement>,
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    const next = this.getNextRunTime("04:00");
    const delay = Math.max(next.getTime() - Date.now(), 60_000);
    this.cleanupTimeout = setTimeout(async () => {
      await this.runMovementCleanup();
      this.cleanupInterval = setInterval(() => this.runMovementCleanup(), 24 * 60 * 60 * 1000);
    }, delay);
    this.logger.log(`Nächste Bewegungs-Bereinigung geplant für ${next.toISOString()}`);
  }

  async onModuleDestroy() {
    if (this.cleanupTimeout) clearTimeout(this.cleanupTimeout);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval as any);
  }

  private getNextRunTime(time: string): Date {
    const [hh, mm] = time.split(":").map(Number);
    const next = new Date();
    next.setHours(hh, mm, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    return next;
  }

  private async runMovementCleanup(): Promise<void> {
    try {
      const days = await this.getMovementRetentionDays();
      const result = await this.deleteOldMovements(days);
      this.logger.log(`Automatische Bewegungs-Bereinigung: ${result.deleted} Einträge gelöscht (>${days} Tage)`);
    } catch (err: any) {
      this.logger.error(`Automatische Bewegungs-Bereinigung fehlgeschlagen: ${err?.message}`);
    }
  }

  async checkIssues(): Promise<{ issues: MaintenanceIssue[]; totalIssues: number }> {
    const issues: MaintenanceIssue[] = [];

    // 1. RestockRequests mit quantityNeeded = 0 die nicht FULFILLED/CANCELLED sind
    const zeroQty = await this.restockRepo.count({
      where: [
        { quantityNeeded: 0, status: "PENDING" },
        { quantityNeeded: 0, status: "APPROVED" },
      ],
    });
    if (zeroQty > 0) {
      issues.push({
        type: "ZERO_QUANTITY_PENDING",
        severity: "warning",
        count: zeroQty,
        description: "Nachbestellanfragen mit Menge 0 die noch offen sind (sollten FULFILLED sein)",
      });
    }

    // 2. Verwaiste RestockRequests ohne StockLevel (stockLevelId verweist auf nichts)
    const orphaned = await this.restockRepo
      .createQueryBuilder("r")
      .leftJoin("stock_levels", "sl", "sl.id = r.stockLevelId")
      .where("sl.id IS NULL")
      .getCount();
    if (orphaned > 0) {
      issues.push({
        type: "ORPHANED_RESTOCK_REQUESTS",
        severity: "error",
        count: orphaned,
        description: "Nachbestellanfragen ohne zugehörigen Lagerbestand (verwaiste Einträge)",
      });
    }

    // 3. Duplikate: mehrere PENDING/APPROVED RestockRequests für denselben StockLevel
    const duplicates = await this.restockRepo
      .createQueryBuilder("r")
      .select("r.stockLevelId", "stockLevelId")
      .addSelect("COUNT(*)", "cnt")
      .where("r.status IN (:...statuses)", { statuses: ["PENDING", "APPROVED"] })
      .groupBy("r.stockLevelId")
      .having("COUNT(*) > 1")
      .getRawMany();
    const dupCount = duplicates.reduce((sum, d) => sum + (parseInt(d.cnt) - 1), 0);
    if (dupCount > 0) {
      issues.push({
        type: "DUPLICATE_RESTOCK_REQUESTS",
        severity: "warning",
        count: dupCount,
        description: `Doppelte offene Nachbestellanfragen für denselben Lagerbestand (${duplicates.length} Positionen betroffen)`,
      });
    }

    // 4. RestockRequests mit Status FULFILLED aber ohne fulfilledAt
    const fulfilledNoDate = await this.restockRepo.count({
      where: { status: "FULFILLED", fulfilledAt: IsNull() },
    });
    if (fulfilledNoDate > 0) {
      issues.push({
        type: "FULFILLED_WITHOUT_DATE",
        severity: "warning",
        count: fulfilledNoDate,
        description: "Als erledigt markierte Anfragen ohne Erledigungsdatum",
      });
    }

    const totalIssues = issues.reduce((sum, i) => sum + i.count, 0);
    return { issues, totalIssues };
  }

  async fixIssues(): Promise<{ fixed: number; message: string }> {
    let fixed = 0;

    // Fix 1: PENDING/APPROVED mit quantityNeeded = 0 → FULFILLED
    const zeroResult = await this.restockRepo
      .createQueryBuilder()
      .update(RestockRequest)
      .set({ status: "FULFILLED", fulfilledAt: new Date() })
      .where("quantityNeeded = 0 AND status IN (:...s)", { s: ["PENDING", "APPROVED"] })
      .execute();
    fixed += zeroResult.affected ?? 0;

    // Fix 2: Verwaiste RestockRequests löschen
    const orphanedIds = await this.restockRepo
      .createQueryBuilder("r")
      .select("r.id", "id")
      .leftJoin("stock_levels", "sl", "sl.id = r.stockLevelId")
      .where("sl.id IS NULL")
      .getRawMany();
    if (orphanedIds.length > 0) {
      await this.restockRepo.delete(orphanedIds.map((r) => r.id));
      fixed += orphanedIds.length;
    }

    // Fix 3: FULFILLED ohne fulfilledAt → Datum setzen
    const dateResult = await this.restockRepo
      .createQueryBuilder()
      .update(RestockRequest)
      .set({ fulfilledAt: new Date() })
      .where("status = 'FULFILLED' AND fulfilledAt IS NULL")
      .execute();
    fixed += dateResult.affected ?? 0;

    // Fix 4: Duplikate – ältere behalten, neuere stornieren
    const duplicates = await this.restockRepo
      .createQueryBuilder("r")
      .select("r.stockLevelId", "stockLevelId")
      .addSelect("COUNT(*)", "cnt")
      .where("r.status IN (:...statuses)", { statuses: ["PENDING", "APPROVED"] })
      .groupBy("r.stockLevelId")
      .having("COUNT(*) > 1")
      .getRawMany();

    for (const dup of duplicates) {
      const requests = await this.restockRepo.find({
        where: { stockLevelId: dup.stockLevelId, status: "PENDING" },
        order: { createdAt: "ASC" },
      });
      // Ersten behalten, Rest stornieren
      const toCancel = requests.slice(1);
      if (toCancel.length > 0) {
        await this.restockRepo.update(
          toCancel.map((r) => r.id),
          { status: "CANCELLED" },
        );
        fixed += toCancel.length;
      }
    }

    this.logger.log(`Wartung: ${fixed} Probleme behoben`);
    return {
      fixed,
      message: fixed > 0 ? `${fixed} Einträge korrigiert.` : "Keine Probleme gefunden.",
    };
  }

  // ─── Datenbank-Statistiken ───────────────────────────────────────────────────

  async getDbStats(): Promise<DbStats> {
    const rows: Array<{
      table_name: string;
      table_rows: string;
      data_length: string;
      index_length: string;
    }> = await this.dataSource.query(`
      SELECT
        table_name,
        COALESCE(table_rows, 0)   AS table_rows,
        COALESCE(data_length, 0)  AS data_length,
        COALESCE(index_length, 0) AS index_length
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
      ORDER BY (data_length + index_length) DESC
    `);

    const tables: DbTableStat[] = rows.map((r) => {
      const dataMb  = Number(r.data_length)  / 1024 / 1024;
      const indexMb = Number(r.index_length) / 1024 / 1024;
      return {
        tableName: r.table_name,
        rows:      Number(r.table_rows),
        dataMb:    Math.round(dataMb  * 100) / 100,
        indexMb:   Math.round(indexMb * 100) / 100,
        totalMb:   Math.round((dataMb + indexMb) * 100) / 100,
      };
    });

    const totalMb = tables.reduce((s, t) => s + t.totalMb, 0);

    const [{ db }] = await this.dataSource.query(`SELECT DATABASE() AS db`);

    return {
      databaseName: db,
      totalMb: Math.round(totalMb * 100) / 100,
      tables,
      retrievedAt: new Date().toISOString(),
    };
  }

  // ─── Bewegungs-Retention ────────────────────────────────────────────────────

  async getMovementRetentionDays(): Promise<number> {
    const cfg = await this.configRepo.findOne({ where: { key: MOVEMENT_RETENTION_KEY } });
    if (cfg?.value) {
      const days = parseInt(cfg.value, 10);
      return isNaN(days) ? MOVEMENT_RETENTION_DEFAULT : days;
    }
    return MOVEMENT_RETENTION_DEFAULT;
  }

  async setMovementRetentionDays(days: number): Promise<void> {
    const existing = await this.configRepo.findOne({ where: { key: MOVEMENT_RETENTION_KEY } });
    if (existing) {
      existing.value = days.toString();
      await this.configRepo.save(existing);
    } else {
      await this.configRepo.save(
        this.configRepo.create({
          key: MOVEMENT_RETENTION_KEY,
          value: days.toString(),
          description: "Aufbewahrungsdauer für Lagerbewegungen in Tagen (GoBD: mind. 3650 Tage empfohlen)",
        }),
      );
    }
  }

  async previewMovementCleanup(days: number): Promise<{ count: number; oldestDate: string | null }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const count = await this.movementRepo.count({ where: { occurredAt: LessThan(cutoff) } });

    const oldest = await this.movementRepo.findOne({
      where: { occurredAt: LessThan(cutoff) },
      order: { occurredAt: "ASC" },
      select: ["occurredAt"],
    });

    return {
      count,
      oldestDate: oldest?.occurredAt?.toISOString() ?? null,
    };
  }

  async deleteOldMovements(days: number): Promise<{ deleted: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await this.movementRepo
      .createQueryBuilder()
      .delete()
      .where("occurredAt < :cutoff", { cutoff })
      .execute();

    return { deleted: result.affected ?? 0 };
  }
}
