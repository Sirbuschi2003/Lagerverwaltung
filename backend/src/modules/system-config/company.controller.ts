import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

import { UpdateCompanyConfigDto } from "./dto/update-company-config.dto";
import { SystemConfigService } from "./system-config.service";

@Controller("company")
export class CompanyController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get("public")
  async getPublicCompanyConfig() {
    return this.systemConfigService.getCompanyConfig();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MANAGER")
  @Get()
  async getCompanyConfig() {
    return this.systemConfigService.getCompanyConfig();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MANAGER")
  @Put()
  async updateCompanyConfig(@Body() dto: UpdateCompanyConfigDto) {
    return this.systemConfigService.updateCompanyConfig(dto);
  }
}
