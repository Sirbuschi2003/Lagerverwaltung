import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class RecordInventoryLineDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsInt()
  @Min(0)
  countedQuantity!: number;

  @IsInt()
  @Min(0)
  expectedQuantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

