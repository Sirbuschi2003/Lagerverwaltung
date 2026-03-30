import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

import { PURCHASE_ORDER_STATUSES, PurchaseOrderStatus } from "../entities/purchase-order.entity";

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsIn(PURCHASE_ORDER_STATUSES)
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
