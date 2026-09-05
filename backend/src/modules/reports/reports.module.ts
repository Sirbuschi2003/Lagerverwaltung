import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { PurchaseOrder } from "../purchasing/entities/purchase-order.entity";
import { PurchaseOrderLine } from "../purchasing/entities/purchase-order-line.entity";
import { Item } from "../items/entities/item.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { LocationsModule } from "../locations/locations.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { ItemsModule } from "../items/items.module";

import { ExportService } from "./export.service";
import { GdpduExportService } from "./gdpdu-export.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([StockMovement, StockLevel, PurchaseOrder, PurchaseOrderLine, Item, Supplier]),
    SystemConfigModule,
    ItemsModule,
    LocationsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ExportService, GdpduExportService],
  exports: [ExportService, GdpduExportService],
})
export class ReportsModule {}
