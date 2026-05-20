import { Body, Controller, Delete, Get, Param, Put, Req, UseGuards, BadRequestException } from "@nestjs/common";
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

  // ── Scan-Töne ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get("scan-sounds")
  async getScanSounds() {
    return this.systemConfigService.getScanSounds();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MANAGER")
  @Put("scan-sounds/:type")
  async setScanSound(
    @Param("type") type: string,
    @Body() body: { dataUrl: string },
  ) {
    if (type !== "success" && type !== "error") {
      throw new BadRequestException('type muss "success" oder "error" sein');
    }
    if (!body.dataUrl?.startsWith("data:audio/")) {
      throw new BadRequestException("Nur Audio-Dateien erlaubt (data:audio/...)");
    }
    // Max. 1 MB Base64 ≈ ~750 KB Audiodatei
    if (body.dataUrl.length > 1_400_000) {
      throw new BadRequestException("Datei zu groß (max. 1 MB)");
    }
    await this.systemConfigService.setScanSound(type, body.dataUrl);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MANAGER")
  @Delete("scan-sounds/:type")
  async deleteScanSound(@Param("type") type: string) {
    if (type !== "success" && type !== "error") {
      throw new BadRequestException('type muss "success" oder "error" sein');
    }
    await this.systemConfigService.deleteScanSound(type);
    return { success: true };
  }
}
