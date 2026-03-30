import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UsersModule } from "../users/users.module";
import { LoggingModule } from "../logging/logging.module";
import { AccessControlModule } from "../access-control/access-control.module";
import { User } from "../users/entities/user.entity";
import { Item } from "../items/entities/item.entity";
import { Vehicle } from "../vehicles/entities/vehicle.entity";
import { Location } from "../locations/entities/location.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { InventorySession } from "../inventory/entities/inventory-session.entity";
import { InventoryLine } from "../inventory/entities/inventory-line.entity";
import { SystemConfig } from "../logging/entities/system-config.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { PurchaseOrder } from "../purchasing/entities/purchase-order.entity";
import { PurchaseOrderLine } from "../purchasing/entities/purchase-order-line.entity";

import { SetupController } from "./setup.controller";
import { SetupService } from "./setup.service";

@Module({
  imports: [
    UsersModule,
    LoggingModule,
    AccessControlModule,
    TypeOrmModule.forFeature([
      User,
      Item,
      Vehicle,
      Location,
      StockLevel,
      StockMovement,
      InventorySession,
      InventoryLine,
      SystemConfig,
      Supplier,
      PurchaseOrder,
      PurchaseOrderLine,
    ]),
  ],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
