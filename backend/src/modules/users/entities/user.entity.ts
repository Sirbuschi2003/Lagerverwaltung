import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Branch } from "../../branches/entities/branch.entity";
import { Warehouse } from "../../warehouses/entities/warehouse.entity";

// Legacy: kept for backward compatibility but not enforced
export const USER_ROLES = ["TECHNICIAN", "WAREHOUSE", "MANAGER"] as const;
export type UserRole = string; // Now allows any role from the system

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 120 })
  username!: string;

  @Column({ type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ type: "varchar", length: 120 })
  displayName!: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  email!: string | null;

  @Column({ type: "varchar", length: 255, default: "TECHNICIAN" })
  role!: UserRole;

  @Column({ type: "char", length: 36, nullable: true })
  vehicleId!: string | null;

  @Column({ type: "char", length: 36, nullable: true })
  branchId!: string | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: "RESTRICT", eager: false })
  @JoinColumn({ name: "branchId" })
  branch!: Branch | null;

  /** Lager-Zuweisung (null = Manager sieht alle Lager der Niederlassung) */
  @Column({ type: "char", length: 36, nullable: true })
  warehouseId!: string | null;

  @ManyToOne(() => Warehouse, { nullable: true, onDelete: "SET NULL", eager: false })
  @JoinColumn({ name: "warehouseId" })
  warehouse!: Warehouse | null;

  @Column({ type: "int", nullable: true, default: 15 })
  refreshInterval!: number | null;

  @Column({ type: "json", nullable: true, default: null })
  settings!: object | null;
}

