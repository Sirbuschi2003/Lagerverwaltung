import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { RestockRequest } from "../stock/entities/restock-request.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";

export interface MaintenanceIssue {
  type: string;
  severity: "error" | "warning";
  count: number;
  description: string;
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    @InjectRepository(RestockRequest)
    private readonly restockRepo: Repository<RestockRequest>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepo: Repository<StockLevel>,
  ) {}

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
}
