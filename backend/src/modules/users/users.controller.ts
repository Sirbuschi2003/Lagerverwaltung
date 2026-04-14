import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards, ForbiddenException, BadRequestException } from "@nestjs/common";
import type { Request } from "express";

interface UsersRequest extends Request {
  user?: { id?: string; role?: string; branchId?: string | null; warehouseId?: string | null };
}

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { LoggingService } from "../logging/services/logging.service";
import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";

import { ChangePasswordDto } from "./dto/change-password.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User } from "./entities/user.entity";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly loggingService: LoggingService,
  ) {}

  @Get()
  @Roles("MANAGER")
  @Permissions("users.view")
  findAll(@Req() req: UsersRequest) {
    // Manager ohne warehouseId sieht alle User seiner Niederlassung
    return this.usersService.findAll(req.user?.branchId, undefined);
  }

  @Get("me")
  getMe(@CurrentUser() user: User) {
    return user;
  }

  @Get("me/settings")
  getMySettings(@CurrentUser() user: User) {
    return this.usersService.getUserSettings(user.id);
  }

  @Put("me/settings")
  updateMySettings(@Body() settings: Record<string, unknown>, @CurrentUser() user: User) {
    return this.usersService.updateUserSettings(user.id, settings);
  }

  @Get("technicians")
  @Roles("WAREHOUSE", "MANAGER")
  findTechnicians(@Req() req: UsersRequest) {
    return this.usersService.findTechnicians(req.user?.branchId);
  }

  @Get(":id")
  @Roles("MANAGER")
  @Permissions("users.view")
  findOne(@Param("id") id: string) {
    return this.usersService.findOneById(id);
  }

  @Post()
  @Roles("MANAGER")
  @Permissions("users.create")
  create(@Body() dto: CreateUserDto, @CurrentUser() currentUser: User) {
    // Branch-Manager: neue User bekommen automatisch die eigene branchId,
    // sofern nicht explizit eine andere angegeben wurde.
    // SUPER_ADMIN (branchId = null): branchId aus DTO übernehmen (kann null sein).
    const branchId = currentUser.branchId !== null
      ? (dto.branchId !== undefined ? dto.branchId : currentUser.branchId)
      : (dto.branchId !== undefined ? dto.branchId : null);
    // warehouseId: immer aus DTO (Manager bestimmt das Lager beim Anlegen)
    const warehouseId = dto.warehouseId ?? null;
    return this.usersService.create({ ...dto, branchId, warehouseId } as any);
  }

  @Patch(":id")
  @Permissions("users.edit")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto, @CurrentUser() currentUser: User) {
    // Users can update themselves, managers can update anyone
    if (currentUser.role !== "MANAGER" && currentUser.id !== id) {
      throw new ForbiddenException("Keine Berechtigung");
    }
    return this.usersService.update(id, dto as any);
  }

  @Delete(":id")
  @Roles("MANAGER")
  @Permissions("users.delete")
  remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }

  /** DSGVO Art. 17: Anonymisierung statt Hard-Delete */
  @Patch(":id/anonymize")
  @Roles("MANAGER")
  @Permissions("users.delete")
  async anonymizeUser(@Param("id") id: string, @CurrentUser() currentUser: User) {
    // Kein Admin darf sich selbst anonymisieren
    if (currentUser.id === id) {
      throw new ForbiddenException("Eigenes Konto kann nicht anonymisiert werden");
    }
    const result = await this.usersService.anonymizeUser(id);
    await this.loggingService.logSecurity(
      "USER_ANONYMIZED",
      `Benutzer ${id} wurde anonymisiert (DSGVO Art. 17)`,
      { userId: currentUser.id, metadata: { targetUserId: id } },
    );
    return result;
  }

  /** DSGVO Art. 15: Datenauszug für betroffene Person */
  @Get(":id/data-export")
  async getUserDataExport(@Param("id") id: string, @CurrentUser() currentUser: User) {
    // Nur eigene Daten oder MANAGER dürfen exportieren
    if (currentUser.role !== "MANAGER" && currentUser.id !== id) {
      throw new ForbiddenException("Keine Berechtigung");
    }
    return this.usersService.getUserDataExport(id);
  }

  @Post("change-password")
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: User) {
    try {
      await this.usersService.changePassword(user.id, dto.currentPassword, dto.newPassword);
      
      // Log die Passwort-Änderung
      await this.loggingService.logPasswordChange(user);
      
      return { message: "Passwort erfolgreich geändert" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      
      // Log den Fehlschlag
      await this.loggingService.logSecurity(
        'PASSWORD_CHANGE_FAILED',
        `Fehlgeschlagene Passwort-Änderung für ${user.username}: ${errorMessage}`,
        {
          userId: user.id,
          metadata: { username: user.username, error: errorMessage }
        }
      );
      
      throw new BadRequestException(errorMessage);
    }
  }
}

