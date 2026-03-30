import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { InventorySession } from "./inventory-session.entity";
import { Vehicle } from "../../vehicles/entities/vehicle.entity";

export enum InventoryVehicleStatusState {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
}

@Entity({ name: "inventory_vehicle_status" })
@Unique(["session", "vehicle"])
export class InventoryVehicleStatus {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => InventorySession, (session) => session.vehicleStatuses, { onDelete: "CASCADE" })
  session!: InventorySession;

  @ManyToOne(() => Vehicle, { onDelete: "CASCADE" })
  vehicle!: Vehicle;

  @Column({ type: "enum", enum: InventoryVehicleStatusState, default: InventoryVehicleStatusState.DRAFT })
  status!: InventoryVehicleStatusState;

  @Column({ type: "varchar", length: 128, nullable: true })
  submittedBy!: string | null;

  @Column({ type: "datetime", nullable: true })
  submittedAt!: Date | null;

  @Column({ type: "boolean", default: false })
  adjustmentsApplied!: boolean;
}
