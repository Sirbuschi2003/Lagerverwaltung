import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class ReceivePurchaseOrderLineDto {
  @IsString()
  lineId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  receivedQuantity?: number;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderLineDto)
  lines!: ReceivePurchaseOrderLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deliveryNoteNumber?: string;
}
