import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class CreatePurchaseOrderLineDto {
  @IsString()
  itemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  packSize?: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  supplierId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines!: CreatePurchaseOrderLineDto[];
}
