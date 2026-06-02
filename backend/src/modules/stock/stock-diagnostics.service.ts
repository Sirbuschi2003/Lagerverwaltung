import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { RestockRequest } from "./entities/restock-request.entity";
import { StockLevel } from "./entities/stock-level.entity";

type VehicleStockLevel = StockLevel & { vehicle: NonNullable<StockLevel["vehicle"]> };

interface DuplicateStockGroup {
  key: string;
  item: string;
  vehicle: string;
  count: number;
  stockLevels: Array<{
    id: string;
    quantity: number;
    targetQuantity: number;
    item: StockLevel["item"];
    vehicle: NonNullable<StockLevel["vehicle"]>;
  }>;
}

export interface RepairResult {
  itemCode: string;
  vehiclesConsolidated: string[];
  finalStockLevel: {
    vehicleId: string;
    vehicleLicensePlate: string;
    currentStock: number;
    targetStock: number;
  };
}

@Injectable()
export class StockDiagnosticsService {
  private readonly logger = new Logger(StockDiagnosticsService.name);

  constructor(
    @InjectRepository(StockLevel)
    private readonly stockLevelsRepository: Repository<StockLevel>,
    @InjectRepository(RestockRequest)
    private readonly restockRepository: Repository<RestockRequest>,
  ) {}

  async diagnoseStockLevels(branchId?: string | null) {
    this.logger.debug("=== STOCKLEVEL DIAGNOSE GESTARTET ===");

    const qb = this.stockLevelsRepository
      .createQueryBuilder("sl")
      .innerJoinAndSelect("sl.item", "item")
      .leftJoinAndSelect("sl.vehicle", "vehicle");
    if (branchId) {
      qb.andWhere("(item.branchId = :branchId OR vehicle.branchId = :branchId)", { branchId });
    }
    const allStockLevels = await qb.getMany();
    this.logger.debug(`Total StockLevels: ${allStockLevels.length}`);

    const combinations = new Map<string, VehicleStockLevel[]>();
    allStockLevels.forEach((stockLevel) => {
      if (!stockLevel.vehicle) return;
      const level = stockLevel as VehicleStockLevel;
      const key = `${level.item.id}_${level.vehicle.id}`;
      if (!combinations.has(key)) combinations.set(key, []);
      combinations.get(key)!.push(level);
    });

    const duplicates: DuplicateStockGroup[] = [];
    for (const [key, stockLevels] of combinations.entries()) {
      if (stockLevels.length > 1) {
        const first = stockLevels[0];
        if (!first) continue;
        duplicates.push({
          key,
          item: first.item.code,
          vehicle: first.vehicle.licensePlate,
          count: stockLevels.length,
          stockLevels: stockLevels.map((level) => ({
            id: level.id,
            quantity: level.quantity,
            targetQuantity: level.targetQuantity,
            item: level.item,
            vehicle: level.vehicle,
          })),
        });
      }
    }

    const duplicateGroups = duplicates.map((duplicate) => ({
      itemCode: duplicate.item,
      itemDescription: duplicate.stockLevels[0]?.item?.description || "Unbekannt",
      duplicateStockLevels: duplicate.stockLevels.map((stockLevel) => ({
        id: stockLevel.id,
        vehicleId: stockLevel.vehicle.id,
        vehicleLicensePlate: stockLevel.vehicle.licensePlate || duplicate.vehicle,
        currentStock: stockLevel.quantity,
        targetStock: stockLevel.targetQuantity,
      })),
    }));

    return {
      duplicateGroups,
      totalDuplicateGroups: duplicates.length,
      totalAffectedStockLevels: duplicates.reduce((sum, d) => sum + d.count, 0),
      summary: `${duplicates.length} Duplikat-Probleme gefunden`,
    };
  }

  async repairDuplicateStockLevels(branchId?: string | null) {
    this.logger.debug("=== STOCKLEVEL REPARATUR GESTARTET ===");

    const qb = this.stockLevelsRepository
      .createQueryBuilder("sl")
      .innerJoinAndSelect("sl.item", "item")
      .leftJoinAndSelect("sl.vehicle", "vehicle");
    if (branchId) {
      qb.andWhere("(item.branchId = :branchId OR vehicle.branchId = :branchId)", { branchId });
    }
    const allStockLevels = await qb.getMany();

    const combinations = new Map<string, VehicleStockLevel[]>();
    allStockLevels.forEach((stockLevel) => {
      if (!stockLevel.vehicle) return;
      const level = stockLevel as VehicleStockLevel;
      const key = `${level.item.id}_${level.vehicle.id}`;
      if (!combinations.has(key)) combinations.set(key, []);
      combinations.get(key)!.push(level);
    });

    const duplicates = Array.from(combinations.entries())
      .filter(([, levels]) => levels.length > 1)
      .map(([key, stockLevels]) => ({
        key,
        item: stockLevels[0]!.item.code,
        vehicle: stockLevels[0]!.vehicle.licensePlate,
        count: stockLevels.length,
        stockLevels,
      }));

    if (duplicates.length === 0) {
      return {
        totalGroupsRepaired: 0,
        totalStockLevelsRemoved: 0,
        details: [],
        message: "Keine Duplikate gefunden - keine Reparatur nötig",
      };
    }

    const repairResults: RepairResult[] = [];
    let totalRemoved = 0;

    for (const duplicate of duplicates) {
      this.logger.debug(`Repariere Duplikat: ${duplicate.item} auf ${duplicate.vehicle}`);
      const primaryStockLevel = duplicate.stockLevels[0]!;
      const duplicateStockLevels = duplicate.stockLevels.slice(1);

      let maxQuantity = primaryStockLevel.quantity;
      let maxTargetQuantity = primaryStockLevel.targetQuantity;
      duplicateStockLevels.forEach((sl) => {
        maxQuantity = Math.max(maxQuantity, sl.quantity);
        maxTargetQuantity = Math.max(maxTargetQuantity, sl.targetQuantity);
      });

      primaryStockLevel.quantity = maxQuantity;
      primaryStockLevel.targetQuantity = maxTargetQuantity;
      await this.stockLevelsRepository.save(primaryStockLevel);

      for (const duplicateSL of duplicateStockLevels) {
        const requests = await this.restockRepository.find({
          where: { stockLevel: { id: duplicateSL.id } },
        });
        for (const request of requests) {
          request.stockLevel = primaryStockLevel;
          request.stockLevelId = primaryStockLevel.id;
          await this.restockRepository.save(request);
        }
        await this.stockLevelsRepository.remove(duplicateSL);
      }

      totalRemoved += duplicateStockLevels.length;
      repairResults.push({
        itemCode: duplicate.item,
        vehiclesConsolidated: [duplicate.vehicle],
        finalStockLevel: {
          vehicleId: primaryStockLevel.vehicle.id,
          vehicleLicensePlate: duplicate.vehicle,
          currentStock: maxQuantity,
          targetStock: maxTargetQuantity,
        },
      });
    }

    this.logger.debug("=== REPARATUR ABGESCHLOSSEN ===");
    return {
      totalGroupsRepaired: duplicates.length,
      totalStockLevelsRemoved: totalRemoved,
      details: repairResults,
    };
  }

  async cleanupRestockRequestDuplicates(): Promise<{
    totalDuplicatesFound: number;
    totalDuplicatesRemoved: number;
    affectedStockLevels: string[];
  }> {
    this.logger.debug("=== RESTOCK REQUEST DUPLIKATE CLEANUP GESTARTET ===");

    const allRequests = await this.restockRepository.find({ order: { createdAt: "ASC" } });
    const grouped = new Map<string, typeof allRequests>();
    for (const req of allRequests) {
      const key = req.stockLevelId;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(req);
    }

    const duplicateGroups = Array.from(grouped.entries()).filter(([, reqs]) => reqs.length > 1);
    this.logger.debug(`Gefunden: ${duplicateGroups.length} StockLevels mit Duplikaten`);

    let totalRemoved = 0;
    const affectedStockLevels: string[] = [];

    for (const [stockLevelId, requests] of duplicateGroups) {
      const duplicates = requests.slice(1);
      for (const dup of duplicates) {
        await this.restockRepository.remove(dup);
        totalRemoved++;
      }
      affectedStockLevels.push(stockLevelId);
    }

    this.logger.debug(`=== CLEANUP ABGESCHLOSSEN: ${totalRemoved} Duplikate entfernt ===`);
    return {
      totalDuplicatesFound: duplicateGroups.reduce((sum, [, reqs]) => sum + (reqs.length - 1), 0),
      totalDuplicatesRemoved: totalRemoved,
      affectedStockLevels,
    };
  }
}
