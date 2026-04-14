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
import { Transform } from "class-transformer";

import { ItemCode } from "./item-code.entity";
import { Location } from "../../locations/entities/location.entity";
import { Supplier } from "../../suppliers/entities/supplier.entity";
import { Branch } from "../../branches/entities/branch.entity";
import { Warehouse } from "../../warehouses/entities/warehouse.entity";

@Entity({ name: "items" })
export class Item {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @OneToMany(() => ItemCode, (itemCode) => itemCode.item, {
    cascade: true,
    eager: true,
    orphanedRowAction: "delete",
  })
  codes!: ItemCode[];

  // Unique pro Niederlassung (Index wird per Migration gesetzt)
  @Column({ type: "varchar", length: 120 })
  code!: string;

  @Column({ type: "char", length: 36, nullable: true })
  branchId!: string | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: "RESTRICT", eager: false })
  @JoinColumn({ name: "branchId" })
  branch!: Branch | null;

  /** Lager-Zugehörigkeit (null = für alle Lager dieser Niederlassung sichtbar) */
  @Column({ type: "char", length: 36, nullable: true })
  warehouseId!: string | null;

  @ManyToOne(() => Warehouse, { nullable: true, onDelete: "SET NULL", eager: false })
  @JoinColumn({ name: "warehouseId" })
  warehouse!: Warehouse | null;

  @Column({ type: "varchar", length: 255 })
  description!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  descriptionSecondary!: string | null;

  @Column({ type: "varchar", length: 120 })
  manufacturer!: string;

  @Column({ type: "varchar", length: 120 })
  productGroup!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  qrCodeValue!: string | null;

  @Column({ type: "int", default: 0 })
  targetStock!: number;

  @Column({ type: "int", nullable: true, default: null })
  minimumStock!: number | null;

  @Column({ type: "int", nullable: true, default: null })
  reorderPoint!: number | null;

  @ManyToOne(() => Location, { nullable: true, onDelete: "SET NULL" })
  storageLocation!: Location | null;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: "SET NULL" })
  supplier!: Supplier | null;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  price!: string | null;

  @Column({ type: "int", nullable: true })
  packSize!: number | null;

  @Column({ type: "int", nullable: true })
  orderQuantity!: number | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  imagePath!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Virtual field für Frontend-Kompatibilität
  @Transform(({ obj }) => obj.codes ? obj.codes.map((code: ItemCode) => code.code) : [], { toPlainOnly: true })
  get alternateCodes(): string[] {
    return this.codes ? this.codes.map(code => code.code) : [];
  }
}
