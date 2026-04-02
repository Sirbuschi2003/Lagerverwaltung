import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { SystemConfigService, EmailTemplate } from "./system-config.service";

interface ConfigRequest extends Request {
  user?: { branchId?: string | null };
}

@Controller("system-config/email-template")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmailTemplateController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get("purchase-order")
  @Permissions("settings.company")
  getPurchaseOrderEmailTemplate(@Req() req: ConfigRequest): Promise<EmailTemplate> {
    return this.systemConfigService.getPurchaseOrderEmailTemplate(req.user?.branchId);
  }

  @Put("purchase-order")
  @Permissions("settings.company")
  setPurchaseOrderEmailTemplate(@Body() template: EmailTemplate, @Req() req: ConfigRequest): Promise<EmailTemplate> {
    return this.systemConfigService.setPurchaseOrderEmailTemplate(template, req.user?.branchId);
  }
}
