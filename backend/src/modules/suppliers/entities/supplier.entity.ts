import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Branch } from "../../branches/entities/branch.entity";
import { Location } from "../../locations/entities/location.entity";

@Entity({ name: "suppliers" })
export class Supplier {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // Unique pro Niederlassung (Index wird per Migration gesetzt)
  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "char", length: 36, nullable: true })
  branchId!: string | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: "RESTRICT", eager: false })
  @JoinColumn({ name: "branchId" })
  branch!: Branch | null;

  @Column({ type: "char", length: 36, nullable: true })
  locationId!: string | null;

  @ManyToOne(() => Location, { nullable: true, onDelete: "SET NULL", eager: false })
  @JoinColumn({ name: "locationId" })
  location!: Location | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  addressLine1!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  addressLine2!: string | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  postalCode!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  city!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  country!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  contactName!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  email!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  customerNumber!: string | null;

  @Column({ type: "varchar", length: 60, nullable: true })
  phone!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  notes!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
