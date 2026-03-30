import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PdfHtmlTemplate, SystemConfigService } from "./system-config.service";

@Controller("setup/purchase-orders/pdf-template")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrderTemplateController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @Roles("MANAGER")
  async getTemplate(): Promise<PdfHtmlTemplate> {
    return this.systemConfigService.getPurchaseOrderPdfTemplate();
  }

  @Put()
  @Roles("MANAGER")
  async updateTemplate(@Body() template: PdfHtmlTemplate): Promise<PdfHtmlTemplate> {
    return this.systemConfigService.setPurchaseOrderPdfTemplate(template);
  }
}
