import { Body, ClassSerializerInterceptor, Controller, Delete, Get, Header, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Put, Req, UseGuards, UseInterceptors, ForbiddenException, BadRequestException } from "@nestjs/common";
import type { Request } from "express";

interface UsersRequest extends Request {
  user?: { id?: string; role?: string; branchId?: string | null; locationIds?: string[] };
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

const SAFE_KEY = /^[a-zA-Z0-9._-]{1,100}$/;
const MAX_SETTINGS_DEPTH = 5;
const MAX_ARRAY_LENGTH = 200;
const MAX_STRING_LENGTH = 2000;

function sanitizeSettings(value: unknown, depth: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return result;
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (!SAFE_KEY.test(key)) continue;
    result[key] = sanitizeValue(val, depth + 1);
  }
  return result;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_SETTINGS_DEPTH) return null;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const nested: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (!SAFE_KEY.test(key)) continue;
      nested[key] = sanitizeValue(val, depth + 1);
    }
    return nested;
  }
  return null;
}

@UseInterceptors(ClassSerializerInterceptor)
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
    return this.usersService.findAll(req.user?.branchId);
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
    const sanitized = sanitizeSettings(settings, 0);
    return this.usersService.updateUserSettings(user.id, sanitized);
  }

  /** DSGVO Art. 20 (Datenportabilität): Eigene personenbezogene Daten als JSON-Download exportieren. */
  @Get("me/export")
  @Header("Content-Disposition", "attachment; filename=\"user-data-export.json\"")
  async exportMyData(@CurrentUser() currentUser: User) {
    return this.usersService.getUserDataExport(currentUser.id);
  }

  @Get("technicians")
  @Roles("WAREHOUSE", "MANAGER")
  findTechnicians(@Req() req: UsersRequest) {
    return this.usersService.findTechnicians(req.user?.branchId);
  }

  @Get(":id")
  @Roles("MANAGER")
  @Permissions("users.view")
  async findOne(@Param("id") id: string, @CurrentUser() currentUser: User) {
    const user = await this.usersService.findOneById(id);
    if (!user) throw new NotFoundException("Benutzer nicht gefunden");

    // Cross-Branch-Schutz: Nicht-Manager dürfen nur eigene Niederlassung einsehen
    if (
      currentUser.role !== "MANAGER" &&
      currentUser.branchId !== null &&
      user.branchId !== currentUser.branchId
    ) {
      throw new NotFoundException("Benutzer nicht gefunden");
    }

    return user;
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
    return this.usersService.create({ ...dto, branchId });
  }

  @Patch(":id")
  @Permissions("users.edit")
  async update(@Param("id") id: string, @Body() dto: UpdateUserDto, @CurrentUser() currentUser: User) {
    if (currentUser.role !== "MANAGER" && currentUser.id !== id) {
      throw new ForbiddenException("Keine Berechtigung");
    }
    if (currentUser.role !== "MANAGER") {
      delete (dto as any).role; delete (dto as any).branchId;
      delete (dto as any).vehicleId; delete (dto as any).locationIds;
    }
    const currentData = await this.usersService.findOneById(id);
    const result = await this.usersService.update(id, dto);
    if (dto.role && currentData && currentData.role !== dto.role) {
      await this.loggingService.logSecurity("USER_ROLE_CHANGED",
        "Rolle von " + currentData.role + " zu " + dto.role + " geaendert fuer Benutzer " + id,
        { userId: currentUser.id, metadata: { targetUserId: id, oldRole: currentData.role, newRole: dto.role } });
    }
    return result;
  }

  @Delete(":id")
  @Roles("MANAGER")
  @Permissions("users.delete")
  async remove(@Param("id") id: string, @CurrentUser() currentUser: User) {
    const userToDelete = await this.usersService.findOneById(id);
    await this.loggingService.logSecurity("USER_DELETED",
      "Benutzer " + id + " wurde geloescht",
      { userId: currentUser.id, metadata: { targetUserId: id, username: userToDelete?.username } });
    return this.usersService.remove(id);
  }

  /** DSGVO Art. 17 (Right to be Forgotten): Anonymisierung eines Benutzerkontos.
   * SUPER_ADMIN kann beliebige User anonymisieren; jeder User darf sich selbst anonymisieren.
   * Kein @Roles-Guard hier, da die Autorisierung methodenseitig geprueft wird (isSelf || isSuperAdmin). */
  @Post(":id/anonymize")
  @HttpCode(HttpStatus.OK)
  async anonymizeUser(@Param("id") id: string, @Req() req: UsersRequest, @CurrentUser() currentUser: User) {
    const isSelf = req.user?.id === id;
    const isSuperAdmin = req.user?.role === "SUPER_ADMIN";
    if (!isSelf && !isSuperAdmin) {
      throw new ForbiddenException("Keine Berechtigung zur Anonymisierung dieses Benutzers");
    }
    await this.usersService.anonymizeUser(id);
    await this.loggingService.logSecurity(
      "USER_ANONYMIZED",
      `Benutzer ${id} wurde anonymisiert (DSGVO Art. 17)`,
      { userId: currentUser.id, metadata: { targetUserId: id, selfAnonymized: isSelf } },
    );
    return { message: "Benutzerdaten wurden anonymisiert.", anonymizedAt: new Date().toISOString() };
  }

  /** DSGVO Art. 15: Datenauszug für betroffene Person (legacy-Endpunkt, bleibt für Abwärtskompatibilität) */
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

