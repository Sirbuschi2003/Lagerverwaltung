import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { Vehicle } from "./entities/vehicle.entity";
import { VehiclesService } from "./vehicles.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";

@Controller("vehicles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @Permissions("vehicles.view")
  findAll(): Promise<Vehicle[]> {
    return this.vehiclesService.findAll();
  }

  @Get(":id")
  @Permissions("vehicles.view")
  findOne(@Param("id") id: string): Promise<Vehicle | null> {
    return this.vehiclesService.findOne(id);
  }

  @Post()
  @Permissions("vehicles.create")
  create(@Body() data: Pick<Vehicle, "licensePlate" | "description">) {
    return this.vehiclesService.create(data);
  }

  @Patch(":id")
  @Permissions("vehicles.edit")
  update(@Param("id") id: string, @Body() data: Partial<Vehicle>) {
    return this.vehiclesService.update(id, data);
  }

  @Delete(":id")
  @Permissions("vehicles.delete")
  remove(@Param("id") id: string) {
    return this.vehiclesService.remove(id);
  }
}

