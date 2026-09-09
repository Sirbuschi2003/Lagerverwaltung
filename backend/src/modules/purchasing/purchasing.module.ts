import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AccessControlModule } from "../access-control/access-control.module";
import { Branch } from "../branches/entities/branch.entity";
import { EmailModule } from "../email/email.module";
import { Item } from "../items/entities/item.entity";
import { ItemsModule } from "../items/items.module";
import { Location } from "../locations/entities/location.entity";
import { LocationsModule } from "../locations/locations.module";
import { LoggingModule } from "../logging/logging.module";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockModule } from "../stock/stock.module";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { SystemConfigModule } from "../system-config/system-config.module";

import { PurchaseOrderLine } from "./entities/purchase-order-line.entity";
import { PurchaseOrder } from "./entities/purchase-order.entity";
import { PurchaseSuggestionService } from "./purchase-suggestion.service";
import { PurchasingController } from "./purchasing.controller";
import { PurchasingService } from "./purchasing.service";


@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, PurchaseOrderLine, Supplier, StockLevel, Item, Branch, Location]),
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
  providers: [PurchasingService, PurchaseSuggestionService],
})
export class PurchasingModule {}
