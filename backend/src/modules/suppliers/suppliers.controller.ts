import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@Controller("suppliers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Permissions("suppliers.view")
  findAll() {
    return this.suppliersService.findAll();
  }

  @Get(":id")
  @Permissions("suppliers.view")
  findOne(@Param("id") id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @Permissions("suppliers.create")
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Patch(":id")
  @Permissions("suppliers.edit")
  update(@Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Delete(":id")
  @Permissions("suppliers.delete")
  remove(@Param("id") id: string) {
    return this.suppliersService.remove(id);
  }
}
