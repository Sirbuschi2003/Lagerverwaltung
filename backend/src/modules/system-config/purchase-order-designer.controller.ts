import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import {
  PurchaseOrderDesignerConfig,
  SystemConfigService,
} from "./system-config.service";

@Controller("setup/purchase-orders/pdf-designer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchaseOrderDesignerController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @Permissions("settings.company")
  async getDesigner(): Promise<PurchaseOrderDesignerConfig> {
    return this.systemConfigService.getPurchaseOrderPdfDesigner();
  }

  @Put()
  @Permissions("settings.company")
  async updateDesigner(
    @Body() config: PurchaseOrderDesignerConfig,
  ): Promise<PurchaseOrderDesignerConfig> {
    return this.systemConfigService.setPurchaseOrderPdfDesigner(config);
  }
}
