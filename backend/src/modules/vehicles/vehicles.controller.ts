import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

interface VehiclesRequest extends Request {
  user?: { id?: string; role?: string; branchId?: string | null };
}

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
  findAll(@Req() req: VehiclesRequest): Promise<Vehicle[]> {
    return this.vehiclesService.findAll(req.user?.branchId);
  }

  @Get(":id")
  @Permissions("vehicles.view")
  findOne(@Req() req: VehiclesRequest, @Param("id") id: string): Promise<Vehicle | null> {
    return this.vehiclesService.findOne(id, req.user?.branchId);
  }

  @Post()
  @Permissions("vehicles.create")
  create(@Body() data: Pick<Vehicle, "licensePlate" | "description">, @Req() req: VehiclesRequest) {
    return this.vehiclesService.create(data, req.user?.branchId);
  }

  @Patch(":id")
  @Permissions("vehicles.edit")
  update(@Req() req: VehiclesRequest, @Param("id") id: string, @Body() data: Partial<Vehicle>) {
    return this.vehiclesService.update(id, data, req.user?.branchId);
  }

  @Delete(":id")
  @Permissions("vehicles.delete")
  remove(@Req() req: VehiclesRequest, @Param("id") id: string) {
    return this.vehiclesService.remove(id, req.user?.branchId);
  }
}
