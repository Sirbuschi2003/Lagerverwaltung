import { Body, ConflictException, Controller, Delete, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from 'express';
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

import { UsersService } from "../users/users.service";

import { CreateInitialAdminDto } from "./dto/create-admin.dto";
import { SetupService } from "./setup.service";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { Permissions } from "../access-control/decorators/permissions.decorator";

@Controller("setup")
export class SetupController {
  constructor(
    private readonly setupService: SetupService,
    private readonly usersService: UsersService,
  ) {}

  @Get("status")
  async status() {
    const needsSetup = await this.setupService.needsSetup();
    return { needsSetup };
  }

  // Max. 3 Setup-Versuche pro 15 Minuten – verhindert automatisierte Angriffe auf frische Instanzen
  @Throttle({ default: { ttl: 900000, limit: 3 } })
  @Post()
  async createInitialAdmin(@Body() dto: CreateInitialAdminDto) {
    const needsSetup = await this.setupService.needsSetup();
    if (!needsSetup) {
      throw new ConflictException("Setup wurde bereits abgeschlossen");
    }

    await this.usersService.create({
      username: dto.username,
      displayName: dto.displayName,
      password: dto.password,
      role: "MANAGER",
    });

    return { success: true };
  }

  @Get("backup")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("MANAGER")
  @Permissions("backup.access")
  async downloadBackup() {
    const backup = await this.setupService.createBackup();
    
    // Serverkopie ablegen, damit Backups im Docker-Volume bestehen bleiben
    try {
      await this.setupService.saveManualBackup(backup);
    } catch (error) {
      /* Backup-Ablage fehlgeschlagen – kein fataler Fehler */
    }

    return backup;
  }

  @Post("restore")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("MANAGER")
  @Permissions("backup.access")
  async restoreBackup(@Body() backup: any) {
    await this.setupService.restoreBackup(backup);
    return { success: true, message: 'Datenbank erfolgreich wiederhergestellt' };
  }

  /**
   * Auto-Backup Konfiguration abrufen
   */
  @Get("backup/auto-config")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("MANAGER")
  @Permissions("backup.access")
  async getAutoBackupConfig() {
    const config = await this.setupService.getAutoBackupConfig();
    return config;
  }

  /**
   * Auto-Backup Konfiguration setzen
   */
  @Post("backup/auto-config")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("MANAGER")
  @Permissions("backup.access")
  async setAutoBackupConfig(@Body() config: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
  }) {
    await this.setupService.setAutoBackupConfig(config);
    return { success: true, config };
  }

  /**
   * Zeitstempel des letzten automatischen Backups abrufen
   */
  @Get("backup/last-auto")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("MANAGER")
  @Permissions("backup.access")
  async getLastAutoBackup() {
    const lastBackup = await this.setupService.getLastAutoBackupTime();
    return { lastBackup };
  }

  /**
   * Liste aller gespeicherten Auto-Backups abrufen
   */
  @Get("backup/list")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("MANAGER")
  @Permissions("backup.access")
  async listAutoBackups() {
    const backups = await this.setupService.listAutoBackups();
    return { backups };
  }

  /**
   * Auto-Backup herunterladen
   */
  @Get("backup/download/:filename")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("MANAGER")
  @Permissions("backup.access")
  async downloadAutoBackup(@Param('filename') filename: string, @Res() res: Response) {
    const filepath = await this.setupService.getAutoBackupPath(filename);
    res.download(filepath);
  }

  /**
   * Auto-Backup löschen
   */
  @Delete("backup/delete/:filename")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("MANAGER")
  @Permissions("backup.access")
  async deleteAutoBackup(@Param('filename') filename: string) {
    await this.setupService.deleteAutoBackup(filename);
    return { success: true, message: 'Backup gelöscht' };
  }
}
