import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { BranchesService } from "./branches.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

@Controller("branches")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @Permissions("branches.view")
  findAll() {
    return this.branchesService.findAll();
  }

  @Get(":id")
  @Permissions("branches.view")
  findOne(@Param("id") id: string) {
    return this.branchesService.findOne(id);
  }

  @Post()
  @Permissions("branches.manage")
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Patch(":id")
  @Permissions("branches.manage")
  update(@Param("id") id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(":id")
  @Permissions("branches.manage")
  remove(@Param("id") id: string) {
    return this.branchesService.remove(id);
  }
}
