import { InventoryVehicleStatusState } from "../entities/inventory-vehicle-status.entity";

export class VehicleStatusDto {
  vehicleId!: string;
  vehicleLabel!: string;
  status!: InventoryVehicleStatusState;
  submittedBy!: string | null;
  submittedAt!: Date | null;
  adjustmentsApplied!: boolean;
}
