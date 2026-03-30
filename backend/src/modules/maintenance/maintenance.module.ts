import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MaintenanceService } from "./maintenance.service";
import { MaintenanceController } from "./maintenance.controller";
import { RestockRequest } from "../stock/entities/restock-request.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";

@Module({
  imports: [TypeOrmModule.forFeature([RestockRequest, StockLevel])],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
