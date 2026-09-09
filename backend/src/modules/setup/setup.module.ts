import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AccessControlModule } from "../access-control/access-control.module";
import { Permission } from "../access-control/entities/permission.entity";
import { RolePermission } from "../access-control/entities/role-permission.entity";
import { Role } from "../access-control/entities/role.entity";
import { UserPermission } from "../access-control/entities/user-permission.entity";
import { Branch } from "../branches/entities/branch.entity";
import { InventoryLine } from "../inventory/entities/inventory-line.entity";
import { InventorySession } from "../inventory/entities/inventory-session.entity";
import { ItemCode } from "../items/entities/item-code.entity";
import { Item } from "../items/entities/item.entity";
import { Location } from "../locations/entities/location.entity";
import { BranchConfig } from "../logging/entities/branch-config.entity";
import { SystemConfig } from "../logging/entities/system-config.entity";
import { LoggingModule } from "../logging/logging.module";
import { PurchaseOrderLine } from "../purchasing/entities/purchase-order-line.entity";
import { PurchaseOrder } from "../purchasing/entities/purchase-order.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { User } from "../users/entities/user.entity";
import { UsersModule } from "../users/users.module";
import { Vehicle } from "../vehicles/entities/vehicle.entity";

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
      BranchConfig,
      Supplier,
      PurchaseOrder,
      PurchaseOrderLine,
      Branch,
      Role,
      Permission,
      RolePermission,
      UserPermission,
      ItemCode,
    ]),
  ],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
