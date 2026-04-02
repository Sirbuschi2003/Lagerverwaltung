import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { SystemConfig } from "../logging/entities/system-config.entity";
import { BranchConfig } from "../logging/entities/branch-config.entity";
import { AccessControlModule } from "../access-control/access-control.module";

import { CompanyController } from "./company.controller";
import { QrTemplateController } from "./qr-template.controller";
import { PdfTemplateController } from "./pdf-template.controller";
import { PurchaseOrderTemplateController } from "./purchase-order-template.controller";
import { PurchaseOrderDesignerController } from "./purchase-order-designer.controller";
import { EmailTemplateController } from "./email-template.controller";
import { SystemConfigService } from "./system-config.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemConfig, BranchConfig]),
    AccessControlModule,
  ],
  controllers: [
    CompanyController,
    QrTemplateController,
    PdfTemplateController,
    PurchaseOrderTemplateController,
    PurchaseOrderDesignerController,
    EmailTemplateController,
  ],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
