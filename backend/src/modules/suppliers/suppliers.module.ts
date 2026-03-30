import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Supplier } from "./entities/supplier.entity";
import { SuppliersController } from "./suppliers.controller";
import { SuppliersService } from "./suppliers.service";
import { AccessControlModule } from "../access-control/access-control.module";

@Module({
  imports: [TypeOrmModule.forFeature([Supplier]), AccessControlModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
