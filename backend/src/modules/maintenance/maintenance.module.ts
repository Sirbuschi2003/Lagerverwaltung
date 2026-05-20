import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MaintenanceService } from "./maintenance.service";
import { MaintenanceController } from "./maintenance.controller";
import { RestockRequest } from "../stock/entities/restock-request.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { SystemConfig } from "../logging/entities/system-config.entity";

@Module({
  imports: [TypeOrmModule.forFeature([RestockRequest, StockLevel, StockMovement, SystemConfig])],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
