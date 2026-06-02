import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

import { StockMovementType } from "../entities/stock-movement.entity";

const MOVEMENT_TYPES: StockMovementType[] = ["CHECKOUT", "CHECKIN", "ADJUSTMENT"];

export class RecordMovementDto {
  @ValidateIf((dto: RecordMovementDto) => !dto.itemCode)
  @IsString()
  @IsNotEmpty()
  itemId?: string;

  @ValidateIf((dto: RecordMovementDto) => !dto.itemId)
  @IsString()
  @IsNotEmpty()
  itemCode?: string;

  @IsOptional()
  @IsUUID("4")
  vehicleId?: string;

  @IsOptional()
  @IsUUID("4")
  locationId?: string;

  @IsOptional()
  @IsUUID("4")
  userId?: string;

  @IsIn(MOVEMENT_TYPES, {
    message: "type must be CHECKOUT, CHECKIN or ADJUSTMENT",
  })
  type!: StockMovementType;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  source!: string;
}
