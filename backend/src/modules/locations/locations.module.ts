import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Location } from "./entities/location.entity";
import { LocationsService } from "./locations.service";
import { LocationsController } from "./locations.controller";
import { AccessControlModule } from "../access-control/access-control.module";

@Module({
  imports: [TypeOrmModule.forFeature([Location]), AccessControlModule],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
