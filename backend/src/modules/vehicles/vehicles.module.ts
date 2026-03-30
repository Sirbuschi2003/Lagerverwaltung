import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Vehicle } from "./entities/vehicle.entity";
import { VehiclesController } from "./vehicles.controller";
import { VehiclesService } from "./vehicles.service";
import { AccessControlModule } from "../access-control/access-control.module";
import { LocationsModule } from "../locations/locations.module";

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle]), AccessControlModule, LocationsModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
