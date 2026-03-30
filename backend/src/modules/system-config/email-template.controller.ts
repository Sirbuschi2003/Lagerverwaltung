import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { SystemConfigService, EmailTemplate } from "./system-config.service";

@Controller("system-config/email-template")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmailTemplateController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get("purchase-order")
  @Permissions("settings.company")
  getPurchaseOrderEmailTemplate(): Promise<EmailTemplate> {
    return this.systemConfigService.getPurchaseOrderEmailTemplate();
  }

  @Put("purchase-order")
  @Permissions("settings.company")
  setPurchaseOrderEmailTemplate(@Body() template: EmailTemplate): Promise<EmailTemplate> {
    return this.systemConfigService.setPurchaseOrderEmailTemplate(template);
  }
}
