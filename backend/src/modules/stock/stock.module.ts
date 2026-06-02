import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AccessControlModule } from "../access-control/access-control.module";
import { ItemsModule } from "../items/items.module";
import { LocationsModule } from "../locations/locations.module";
import { LoggingModule } from "../logging/logging.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { VehiclesModule } from "../vehicles/vehicles.module";

import { InventorySession } from "../inventory/entities/inventory-session.entity";
import { RestockRequest } from "./entities/restock-request.entity";
import { StockLevel } from "./entities/stock-level.entity";
import { StockMovement } from "./entities/stock-movement.entity";
import { StockAdminController } from "./stock-admin.controller";
import { StockController } from "./stock.controller";
import { StockGateway } from "./stock.gateway";
import { StockService } from "./stock.service";
import { StockDiagnosticsService } from "./stock-diagnostics.service";
import { MovementQueryService } from "./movement-query.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([StockLevel, StockMovement, RestockRequest, InventorySession]),
    ItemsModule,
    LoggingModule,
    AccessControlModule,
    NotificationsModule,
    UsersModule,
    VehiclesModule,
    LocationsModule,
  ],
  controllers: [StockController, StockAdminController],
  providers: [StockService, StockGateway, StockDiagnosticsService, MovementQueryService],
  exports: [StockService, StockDiagnosticsService, MovementQueryService],
})
export class StockModule {}
