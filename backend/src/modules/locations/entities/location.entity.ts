import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { Vehicle } from "../../vehicles/entities/vehicle.entity";
import { Branch } from "../../branches/entities/branch.entity";

export const LOCATION_TYPES = ["WAREHOUSE", "SHELF", "BIN", "VEHICLE"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

@Entity({ name: "locations" })
@Index(["parent", "code"], { unique: true })
export class Location {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "enum", enum: LOCATION_TYPES })
  type!: LocationType;

  @Column({ type: "varchar", length: 120 })
  code!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  name!: string | null;

  @ManyToOne(() => Location, (location) => location.children, { nullable: true, onDelete: "SET NULL" })
  parent!: Location | null;

  @OneToMany(() => Location, (location) => location.parent)
  children!: Location[];

  @Index({ unique: true })
  @ManyToOne(() => Vehicle, { nullable: true, onDelete: "CASCADE" })
  vehicle!: Vehicle | null;

  @Column({ type: "char", length: 36, nullable: true })
  branchId!: string | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: "RESTRICT", eager: false })
  @JoinColumn({ name: "branchId" })
  branch!: Branch | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
