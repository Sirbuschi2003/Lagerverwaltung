import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

import { SystemConfigService, VehicleQrTemplateConfig } from "./system-config.service";

interface ConfigRequest extends Request {
  user?: { branchId?: string | null };
}

@Controller("setup/reports/qr-template")
export class QrTemplateController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MANAGER")
  @Get()
  async getQrTemplate(@Req() req: ConfigRequest): Promise<VehicleQrTemplateConfig> {
    return this.systemConfigService.getVehicleQrTemplateConfig(req.user?.branchId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MANAGER")
  @Put()
  async setQrTemplate(@Body() cfg: VehicleQrTemplateConfig, @Req() req: ConfigRequest): Promise<VehicleQrTemplateConfig> {
    return this.systemConfigService.setVehicleQrTemplateConfig(cfg, req.user?.branchId);
  }
}
