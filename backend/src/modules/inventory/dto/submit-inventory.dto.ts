import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class SubmitInventoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientChecksum?: string;

  @IsOptional()
  @IsBoolean()
  applyAdjustments?: boolean;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
