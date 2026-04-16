import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ItemCode } from "./entities/item-code.entity";
import { Item } from "./entities/item.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { Location } from "../locations/entities/location.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { ItemsController } from "./items.controller";
import { ItemsService } from "./items.service";
import { AccessControlModule } from "../access-control/access-control.module";
import { LoggingModule } from "../logging/logging.module";

@Module({
  imports: [TypeOrmModule.forFeature([Item, ItemCode, StockLevel, StockMovement, Location, Supplier]), AccessControlModule, LoggingModule],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}


