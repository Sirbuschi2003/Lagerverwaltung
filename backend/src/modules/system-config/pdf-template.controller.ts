import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PdfHtmlTemplate, SystemConfigService } from "./system-config.service";

@Controller("setup/reports/pdf-template")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PdfTemplateController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @Roles("MANAGER")
  async getPdfTemplate(): Promise<PdfHtmlTemplate> {
    return this.systemConfigService.getPdfHtmlTemplate();
  }

  @Put()
  @Roles("MANAGER")
  async updatePdfTemplate(@Body() template: PdfHtmlTemplate): Promise<PdfHtmlTemplate> {
    return this.systemConfigService.setPdfHtmlTemplate(template);
  }
}
