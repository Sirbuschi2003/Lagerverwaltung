import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AccessControlModule } from "../access-control/access-control.module";
import { LocationsModule } from "../locations/locations.module";
import { User } from "../users/entities/user.entity";

import { Vehicle } from "./entities/vehicle.entity";
import { VehiclesController } from "./vehicles.controller";
import { VehiclesService } from "./vehicles.service";

@Module({
  // User-Entity direkt eingebunden (nicht das ganze UsersModule, um keine
  // Modul-Abhaengigkeit aufzubauen): VehiclesService muss beim Loeschen
  // eines Fahrzeugs die verwaiste users.vehicleId-Referenz bereinigen
  // koennen (kein DB-Constraint dafuer vorhanden, siehe VehiclesService.remove).
  imports: [TypeOrmModule.forFeature([Vehicle, User]), AccessControlModule, LocationsModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
