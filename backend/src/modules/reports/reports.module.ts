import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { SystemConfigModule } from "../system-config/system-config.module";
import { ItemsModule } from "../items/items.module";

import { ExportService } from "./export.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [TypeOrmModule.forFeature([StockMovement, StockLevel]), SystemConfigModule, ItemsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ExportService],
  exports: [ExportService],
})
export class ReportsModule {}
