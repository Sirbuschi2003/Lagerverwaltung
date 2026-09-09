import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";

import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

import { SystemConfigService, EmailTemplate } from "./system-config.service";

@Controller("system-config/email-template")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmailTemplateController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get("purchase-order")
  @Permissions("settings.company")
  getPurchaseOrderEmailTemplate(@Req() req: Request): Promise<EmailTemplate> {
    return this.systemConfigService.getPurchaseOrderEmailTemplate(req.user?.branchId);
  }

  @Put("purchase-order")
  @Permissions("settings.company")
  setPurchaseOrderEmailTemplate(@Body() template: EmailTemplate, @Req() req: Request): Promise<EmailTemplate> {
    return this.systemConfigService.setPurchaseOrderEmailTemplate(template, req.user?.branchId);
  }
}
