import { Type } from "class-transformer";
import { IsArray, IsInt, IsNumber, IsOptional, IsString, IsUppercase, Length, MaxLength, Min, ValidateNested } from "class-validator";

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

  // §240 HGB: Einstandspreis (Netto) pro Einheit
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitPriceNet?: number;

  // Steuersatz in Prozent (Standard: 19)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate?: number;

  // ISO-4217 Währungscode (Standard: EUR)
  @IsOptional()
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  currency?: string;
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
