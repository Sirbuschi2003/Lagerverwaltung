import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import { InventoryLine } from "./inventory-line.entity";
import { InventoryVehicleStatus } from "./inventory-vehicle-status.entity";

export enum InventorySessionStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  FINALIZED = "FINALIZED",
  CANCELLED = "CANCELLED",
}

@Entity({ name: "inventory_sessions" })
export class InventorySession {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 120 })
  createdBy!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  location!: string | null;

  @Column({ type: "timestamp" })
  startedAt!: Date;

  @Column({ type: "timestamp", nullable: true })
  completedAt!: Date | null;

  @Column({
    type: "enum",
    enum: InventorySessionStatus,
    default: InventorySessionStatus.DRAFT,
  })
  status!: InventorySessionStatus;

  @Column({ type: "varchar", length: 120, nullable: true })
  submittedBy!: string | null;

  @Column({ type: "timestamp", nullable: true })
  submittedAt!: Date | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  finalizedBy!: string | null;

  @Column({ type: "timestamp", nullable: true })
  finalizedAt!: Date | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  clientChecksum!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  serverChecksum!: string | null;

  @Column({ type: "boolean", default: false })
  adjustmentsApplied!: boolean;

  @OneToMany(() => InventoryLine, (line) => line.session, { cascade: true })
  lines!: InventoryLine[];

  @OneToMany(() => InventoryVehicleStatus, (vs) => vs.session, { cascade: true })
  vehicleStatuses?: InventoryVehicleStatus[];

  @CreateDateColumn()
  createdAt!: Date;
}

