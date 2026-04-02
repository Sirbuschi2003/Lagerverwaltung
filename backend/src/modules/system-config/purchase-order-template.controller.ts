import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PdfHtmlTemplate, SystemConfigService } from "./system-config.service";

interface ConfigRequest extends Request {
  user?: { branchId?: string | null };
}

@Controller("setup/purchase-orders/pdf-template")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrderTemplateController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @Roles("MANAGER")
  async getTemplate(@Req() req: ConfigRequest): Promise<PdfHtmlTemplate> {
    return this.systemConfigService.getPurchaseOrderPdfTemplate(req.user?.branchId);
  }

  @Put()
  @Roles("MANAGER")
  async updateTemplate(@Body() template: PdfHtmlTemplate, @Req() req: ConfigRequest): Promise<PdfHtmlTemplate> {
    return this.systemConfigService.setPurchaseOrderPdfTemplate(template, req.user?.branchId);
  }
}
