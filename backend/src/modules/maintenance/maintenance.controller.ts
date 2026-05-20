import {
  Controller, Get, Post, Put, Body, Query,
  UseGuards, Request, ForbiddenException, BadRequestException,
} from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("maintenance")
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  private requireManager(req: any) {
    if (req.user?.role !== "MANAGER") {
      throw new ForbiddenException("Nur Administratoren können die Wartung ausführen.");
    }
  }

  private requireSuperAdmin(req: any) {
    if (req.user?.role !== "MANAGER" || req.user?.branchId !== null) {
      throw new ForbiddenException("Nur Super-Admins können diese Aktion ausführen.");
    }
  }

  @Get("check")
  async check(@Request() req: any) {
    this.requireManager(req);
    return this.maintenanceService.checkIssues();
  }

  @Post("fix")
  async fix(@Request() req: any) {
    this.requireManager(req);
    return this.maintenanceService.fixIssues();
  }

  // ─── Datenbank-Statistiken ─────────────────────────────────────────────────

  @Get("db-stats")
  async getDbStats(@Request() req: any) {
    this.requireSuperAdmin(req);
    return this.maintenanceService.getDbStats();
  }

  // ─── Bewegungs-Retention ───────────────────────────────────────────────────

  @Get("movement-retention")
  async getMovementRetention(@Request() req: any) {
    this.requireSuperAdmin(req);
    const days = await this.maintenanceService.getMovementRetentionDays();
    return { retentionDays: days };
  }

  @Put("movement-retention")
  async setMovementRetention(@Body() body: { retentionDays: number }, @Request() req: any) {
    this.requireSuperAdmin(req);
    const days = Number(body.retentionDays);
    if (!days || isNaN(days) || days < 365 || days > 36500) {
      throw new BadRequestException("Aufbewahrungsdauer muss zwischen 365 und 36500 Tagen liegen.");
    }
    await this.maintenanceService.setMovementRetentionDays(days);
    return { success: true, retentionDays: days };
  }

  @Get("movement-cleanup/preview")
  async previewMovementCleanup(@Query("days") days: string, @Request() req: any) {
    this.requireSuperAdmin(req);
    const daysNum = Number(days);
    if (!daysNum || isNaN(daysNum) || daysNum < 365) {
      throw new BadRequestException("days muss >= 365 sein.");
    }
    return this.maintenanceService.previewMovementCleanup(daysNum);
  }

  @Post("movement-cleanup")
  async runMovementCleanup(@Body() body: { days: number }, @Request() req: any) {
    this.requireSuperAdmin(req);
    const days = Number(body.days);
    if (!days || isNaN(days) || days < 365) {
      throw new BadRequestException("days muss >= 365 sein.");
    }
    return this.maintenanceService.deleteOldMovements(days);
  }
}
