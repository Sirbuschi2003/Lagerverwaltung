import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class FinalizeInventoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientChecksum?: string;

  @IsOptional()
  @IsBoolean()
  applyAdjustments?: boolean;
}
