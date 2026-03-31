import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Transform } from "class-transformer";

import { ItemCode } from "./item-code.entity";
import { Location } from "../../locations/entities/location.entity";
import { Supplier } from "../../suppliers/entities/supplier.entity";

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

  @Index({ unique: true })
  @Column({ type: "varchar", length: 120 })
  code!: string;

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
