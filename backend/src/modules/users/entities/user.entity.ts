import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

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
  @Column({ type: "int", nullable: true, default: 15 })
  refreshInterval!: number | null;

  @Column({ type: "json", nullable: true, default: null })
  settings!: object | null;
}

