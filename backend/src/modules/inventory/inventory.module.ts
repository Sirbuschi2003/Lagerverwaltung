import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ItemsModule } from "../items/items.module";
import { SystemConfig } from "../logging/entities/system-config.entity";
import { LoggingModule } from "../logging/logging.module";
import { ReportsModule } from "../reports/reports.module";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockModule } from "../stock/stock.module";
import { User } from "../users/entities/user.entity";
import { UsersModule } from "../users/users.module";
import { VehiclesModule } from "../vehicles/vehicles.module";

import { InventoryLine } from "./entities/inventory-line.entity";
import { InventorySession } from "./entities/inventory-session.entity";
import { InventoryVehicleStatus } from "./entities/inventory-vehicle-status.entity";
import { InventoryTemplateService } from "./inventory-template.service";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";


@Module({
  imports: [
    TypeOrmModule.forFeature([InventorySession, InventoryLine, InventoryVehicleStatus, StockLevel, SystemConfig, User]),
    ItemsModule,
    VehiclesModule,
    StockModule,
    ReportsModule,
    UsersModule,
    LoggingModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryTemplateService],
})
export class InventoryModule {}
