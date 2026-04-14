import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

interface WarehousesRequest extends Request {
  user?: { id?: string; role?: string; branchId?: string | null };
}

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { WarehousesService } from "./warehouses.service";

@Controller("warehouses")
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  /** Alle Lager – gefiltert nach Niederlassung des anfragenden Benutzers */
  @Get()
  @Roles("MANAGER", "WAREHOUSE", "TECHNICIAN")
  findAll(@Req() req: WarehousesRequest, @Query("branchId") branchId?: string) {
    // Super-Admin kann optional nach branchId filtern
    const isSuperAdmin = req.user?.role === "MANAGER" && req.user?.branchId === null;
    if (isSuperAdmin) {
      return this.warehousesService.findAll(branchId ?? undefined);
    }
    return this.warehousesService.findAll(req.user?.branchId);
  }

  @Get(":id")
  @Roles("MANAGER", "WAREHOUSE")
  findOne(@Param("id") id: string) {
    return this.warehousesService.findOne(id);
  }

  @Post()
  @Roles("MANAGER")
  create(@Body() dto: CreateWarehouseDto, @Req() req: WarehousesRequest) {
    const isSuperAdmin = req.user?.role === "MANAGER" && req.user?.branchId === null;
    return this.warehousesService.create(
      dto,
      isSuperAdmin ? null : req.user?.branchId,
    );
  }

  @Patch(":id")
  @Roles("MANAGER")
  update(@Param("id") id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, dto);
  }

  @Delete(":id")
  @Roles("MANAGER")
  remove(@Param("id") id: string) {
    return this.warehousesService.remove(id);
  }
}
