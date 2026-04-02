import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

import { UpdateCompanyConfigDto } from "./dto/update-company-config.dto";
import { SystemConfigService } from "./system-config.service";

interface CompanyRequest extends Request {
  user?: { branchId?: string | null };
}

@Controller("company")
export class CompanyController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get("public")
  async getPublicCompanyConfig() {
    // Öffentlich – gibt immer die globale Konfiguration zurück (branchId = null)
    return this.systemConfigService.getCompanyConfig();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MANAGER")
  @Get()
  async getCompanyConfig(@Req() req: CompanyRequest) {
    return this.systemConfigService.getCompanyConfig(req.user?.branchId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MANAGER")
  @Put()
  async updateCompanyConfig(@Body() dto: UpdateCompanyConfigDto, @Req() req: CompanyRequest) {
    return this.systemConfigService.updateCompanyConfig(dto, req.user?.branchId);
  }
}
