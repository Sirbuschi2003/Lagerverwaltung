import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ItemsModule } from "../items/items.module";
import { LocationsModule } from "../locations/locations.module";
import { StockModule } from "../stock/stock.module";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { Item } from "../items/entities/item.entity";
import { PurchaseOrder } from "./entities/purchase-order.entity";
import { PurchaseOrderLine } from "./entities/purchase-order-line.entity";
import { PurchasingController } from "./purchasing.controller";
import { PurchasingService } from "./purchasing.service";
import { AccessControlModule } from "../access-control/access-control.module";
import { EmailModule } from "../email/email.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { LoggingModule } from "../logging/logging.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, PurchaseOrderLine, Supplier, StockLevel, Item]),
    AccessControlModule,
    EmailModule,
    ItemsModule,
    LocationsModule,
    SuppliersModule,
    StockModule,
    SystemConfigModule,
    LoggingModule,
  ],
  controllers: [PurchasingController],
  providers: [PurchasingService],
})
export class PurchasingModule {}
