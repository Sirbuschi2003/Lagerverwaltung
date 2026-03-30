import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

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
    @Query("type") type?: string,
    @Query("parentId") parentId?: string,
    @Query("includeVehicles") includeVehicles?: string,
  ) {
    return this.locationsService.findAll({
      type,
      parentId,
      includeVehicles: includeVehicles === "true",
    });
  }

  @Get(":id")
  @Permissions("locations.view")
  findOne(@Param("id") id: string) {
    return this.locationsService.findOne(id);
  }

  @Post()
  @Permissions("locations.create")
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
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
