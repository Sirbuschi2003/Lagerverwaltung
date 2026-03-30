import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

import { SystemConfigService, VehicleQrTemplateConfig } from "./system-config.service";

@Controller("setup/reports/qr-template")
export class QrTemplateController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MANAGER")
  @Get()
  async getQrTemplate(): Promise<VehicleQrTemplateConfig> {
    return this.systemConfigService.getVehicleQrTemplateConfig();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MANAGER")
  @Put()
  async setQrTemplate(@Body() cfg: VehicleQrTemplateConfig): Promise<VehicleQrTemplateConfig> {
    return this.systemConfigService.setVehicleQrTemplateConfig(cfg);
  }
}
