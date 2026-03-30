import { IsString, IsUUID } from "class-validator";

export class RemoveVehicleStockDto {
  @IsUUID()
  sessionId!: string;

  @IsUUID()
  vehicleId!: string;

  @IsUUID()
  itemId!: string;
}
