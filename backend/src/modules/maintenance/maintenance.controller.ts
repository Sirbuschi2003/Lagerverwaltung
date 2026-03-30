import { Controller, Get, Post, UseGuards, Request, ForbiddenException } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("maintenance")
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get("check")
  async check(@Request() req: any) {
    if (req.user?.role !== "MANAGER") {
      throw new ForbiddenException("Nur Administratoren können die Wartung ausführen.");
    }
    return this.maintenanceService.checkIssues();
  }

  @Post("fix")
  async fix(@Request() req: any) {
    if (req.user?.role !== "MANAGER") {
      throw new ForbiddenException("Nur Administratoren können die Wartung ausführen.");
    }
    return this.maintenanceService.fixIssues();
  }
}
