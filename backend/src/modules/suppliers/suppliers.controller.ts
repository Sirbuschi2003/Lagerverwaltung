import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@Controller("suppliers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Permissions("suppliers.view")
  findAll(@Req() req: Request) {
    return this.suppliersService.findAll(req.user?.branchId, req.user?.locationIds);
  }

  @Get(":id")
  @Permissions("suppliers.view")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return this.suppliersService.findOne(id, req.user?.branchId);
  }

  @Post()
  @Permissions("suppliers.create")
  create(@Body() dto: CreateSupplierDto, @Req() req: Request) {
    const locationId = req.user?.locationIds?.length ? req.user.locationIds[0] : null;
    return this.suppliersService.create(dto, req.user?.branchId, locationId);
  }

  @Patch(":id")
  @Permissions("suppliers.edit")
  update(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto, req.user?.branchId);
  }

  @Delete(":id")
  @Permissions("suppliers.delete")
  remove(@Req() req: Request, @Param("id") id: string) {
    return this.suppliersService.remove(id, req.user?.branchId);
  }
}
