import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AccessControlModule } from "../access-control/access-control.module";
import { Location } from "../locations/entities/location.entity";
import { LocationsModule } from "../locations/locations.module";
import { LoggingModule } from "../logging/logging.module";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";

import { ItemCode } from "./entities/item-code.entity";
import { Item } from "./entities/item.entity";
import { ItemsController } from "./items.controller";
import { ItemsService } from "./items.service";


@Module({
  imports: [TypeOrmModule.forFeature([Item, ItemCode, StockLevel, StockMovement, Location, Supplier]), AccessControlModule, LoggingModule, LocationsModule],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}


