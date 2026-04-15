import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Branch } from "../../branches/entities/branch.entity";
import { Location } from "../../locations/entities/location.entity";

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

  /**
   * Lager-Zuweisung: welche WAREHOUSE-Lagerorte dieser Benutzer sehen darf.
   * Leer = Manager sieht alle Lager der Niederlassung.
   */
  @ManyToMany(() => Location, { eager: true, onDelete: "CASCADE" })
  @JoinTable({
    name: "user_locations",
    joinColumn: { name: "userId", referencedColumnName: "id" },
    inverseJoinColumn: { name: "locationId", referencedColumnName: "id" },
  })
  locations!: Location[];

  @Column({ type: "int", nullable: true, default: 15 })
  refreshInterval!: number | null;

  @Column({ type: "json", nullable: true, default: null })
  settings!: object | null;
}
