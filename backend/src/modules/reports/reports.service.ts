import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";

import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly movementsRepository: Repository<StockMovement>,
    @InjectRepository(StockLevel)
    private readonly stockLevelsRepository: Repository<StockLevel>,
  ) {}

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
