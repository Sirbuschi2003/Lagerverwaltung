import { IsArray, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateItemDto {
  @IsString()
  @MaxLength(120)
  code!: string;

  @IsString()
  @MaxLength(255)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descriptionSecondary?: string;

  @IsString()
  @MaxLength(120)
  manufacturer!: string;

  @IsString()
  @MaxLength(120)
  productGroup!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  qrCodeValue?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  targetStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  storageLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  supplierId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  packSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentQuantity?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alternateCodes?: string[];
}
