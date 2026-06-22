import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { Supplier } from "../../suppliers/entities/supplier.entity";
import { PurchaseOrderLine } from "./purchase-order-line.entity";
import { Branch } from "../../branches/entities/branch.entity";
import { Location } from "../../locations/entities/location.entity";

export const PURCHASE_ORDER_STATUSES = ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED", "ARCHIVED"] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

@Entity({ name: "purchase_orders" })
export class PurchaseOrder {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Supplier, { eager: false, onDelete: "RESTRICT" })
  supplier!: Supplier;

  @Column({ type: "enum", enum: PURCHASE_ORDER_STATUSES, default: "DRAFT" })
  status!: PurchaseOrderStatus;

  @Column({ type: "varchar", length: 64, nullable: true })
  orderNumber!: string | null;

  @Column({ type: "timestamp", nullable: true })
  orderedAt!: Date | null;

  @Column({ type: "timestamp", nullable: true })
  receivedAt!: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  note!: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  deliveryNoteNumber!: string | null;

  @Column({ type: "json", nullable: true })
  deliveryNoteHistory!: Array<{ number: string; date: string }> | null;

  @OneToMany(() => PurchaseOrderLine, (line) => line.order, { cascade: true, eager: false })
  lines!: PurchaseOrderLine[];

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
