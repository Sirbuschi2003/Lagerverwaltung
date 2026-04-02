import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import {
  PurchaseOrderDesignerConfig,
  SystemConfigService,
} from "./system-config.service";

interface ConfigRequest extends Request {
  user?: { branchId?: string | null };
}

@Controller("setup/purchase-orders/pdf-designer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchaseOrderDesignerController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @Permissions("settings.company")
  async getDesigner(@Req() req: ConfigRequest): Promise<PurchaseOrderDesignerConfig> {
    return this.systemConfigService.getPurchaseOrderPdfDesigner(req.user?.branchId);
  }

  @Put()
  @Permissions("settings.company")
  async updateDesigner(@Body() config: PurchaseOrderDesignerConfig, @Req() req: ConfigRequest): Promise<PurchaseOrderDesignerConfig> {
    return this.systemConfigService.setPurchaseOrderPdfDesigner(config, req.user?.branchId);
  }
}
