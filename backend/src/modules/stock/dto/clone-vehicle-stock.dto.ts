import { IsBoolean, IsOptional, IsUUID } from "class-validator";

export class CloneVehicleStockDto {
  @IsUUID()
  sourceVehicleId!: string;

  @IsUUID()
  targetVehicleId!: string;

  @IsOptional()
  @IsBoolean()
  copyQuantities?: boolean = true;
}
