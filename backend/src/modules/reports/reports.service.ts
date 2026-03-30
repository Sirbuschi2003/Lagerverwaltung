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

  async consumptionReport(from: Date, to: Date) {
    const movements = await this.movementsRepository.find({
      where: { occurredAt: Between(from, to) },
      order: { occurredAt: "ASC" },
    });

    return movements;
  }

  async stockStatusSummary() {
    return this.stockLevelsRepository.find({
      order: { vehicle: { licensePlate: "ASC" } },
    });
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

