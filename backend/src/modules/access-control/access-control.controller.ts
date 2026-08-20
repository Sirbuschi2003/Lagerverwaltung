import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AccessControlService } from "./access-control.service";
import { Permissions } from "./decorators/permissions.decorator";
import { PermissionsGuard } from "./guards/permissions.guard";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { UpdateUserPermissionsDto } from "./dto/update-user-permissions.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

interface AuthReq extends Request {
  user?: { id?: string; sub?: string };
}

function actorId(req: AuthReq): string | undefined {
  return req.user?.id ?? req.user?.sub;
}

@Controller("access-control")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Get("permissions")
  @Roles("MANAGER")
  @Permissions("access.manage")
  listPermissions() {
    return this.accessControlService.listPermissions();
  }

  @Get("roles/list")
  @Roles("MANAGER")
  @Permissions("access.manage")
  listRolesList() {
    return this.accessControlService.listRolesWithPermissions();
  }

  @Get("roles")
  @Roles("MANAGER")
  @Permissions("access.manage")
  listRoles() {
    return this.accessControlService.listRolesWithPermissions();
  }

  @Post("roles")
  @Roles("MANAGER")
  @Permissions("access.manage")
  createRole(@Body() body: CreateRoleDto, @Req() req: AuthReq) {
    return this.accessControlService.createRole(body.name, body.description, actorId(req));
  }

  @Patch("roles/:roleId")
  @Roles("MANAGER")
  @Permissions("access.manage")
  updateRole(@Param("roleId", ParseIntPipe) roleId: number, @Body() body: UpdateRoleDto, @Req() req: AuthReq) {
    return this.accessControlService.updateRole(roleId, body.name, body.description, actorId(req));
  }

  @Delete("roles/:roleId")
  @Roles("MANAGER")
  @Permissions("access.manage")
  async deleteRole(@Param("roleId", ParseIntPipe) roleId: number, @Req() req: AuthReq) {
    await this.accessControlService.deleteRole(roleId, actorId(req));
    return { message: "Role deleted" };
  }

  @Patch("roles/:role/permissions")
  @Roles("MANAGER")
  @Permissions("access.manage")
  updateRolePermissions(@Param("role") role: string, @Body() body: UpdateRolePermissionsDto, @Req() req: AuthReq) {
    return this.accessControlService.setRolePermissions(role, body.permissions ?? [], actorId(req));
  }

  @Get("users/:userId/permissions")
  @Roles("MANAGER")
  @Permissions("access.manage")
  async getUserPermissions(@Param("userId") userId: string) {
    const { overrides, denials, permissions, role } = await this.accessControlService.getEffectivePermissionsForUserId(userId);
    return { overrides, denials, effective: permissions, role };
  }

  @Patch("users/:userId/permissions")
  @Roles("MANAGER")
  @Permissions("access.manage")
  updateUserOverrides(@Param("userId") userId: string, @Body() body: UpdateUserPermissionsDto, @Req() req: AuthReq) {
    return this.accessControlService.setUserOverrides(userId, body.overrides ?? [], body.denials ?? [], actorId(req));
  }
}
