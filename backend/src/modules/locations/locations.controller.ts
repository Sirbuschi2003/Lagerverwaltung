import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

interface LocationsRequest extends Request {
  user?: { id?: string; role?: string; branchId?: string | null };
}

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { CreateLocationDto } from "./dto/create-location.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { LocationsService } from "./locations.service";

@Controller("locations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @Permissions("locations.view")
  findAll(
    @Req() req: LocationsRequest,
    @Query("type") type?: string,
    @Query("parentId") parentId?: string,
    @Query("includeVehicles") includeVehicles?: string,
  ) {
    return this.locationsService.findAll({
      type,
      parentId,
      includeVehicles: includeVehicles === "true",
      branchId: req.user?.branchId,
    });
  }

  @Get(":id")
  @Permissions("locations.view")
  findOne(@Req() req: LocationsRequest, @Param("id") id: string) {
    return this.locationsService.findOne(id, req.user?.branchId);
  }

  @Post()
  @Permissions("locations.create")
  create(@Body() dto: CreateLocationDto, @Req() req: LocationsRequest) {
    return this.locationsService.create({ ...dto, branchId: req.user?.branchId });
  }

  @Patch(":id")
  @Permissions("locations.edit")
  update(@Param("id") id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto);
  }

  @Delete(":id")
  @Permissions("locations.delete")
  remove(@Param("id") id: string) {
    return this.locationsService.remove(id);
  }
}
