import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { Supplier } from "../../suppliers/entities/supplier.entity";
import { PurchaseOrderLine } from "./purchase-order-line.entity";

export const PURCHASE_ORDER_STATUSES = ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED", "ARCHIVED"] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

@Entity({ name: "purchase_orders" })
export class PurchaseOrder {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Supplier, { eager: true, onDelete: "RESTRICT" })
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

  @OneToMany(() => PurchaseOrderLine, (line) => line.order, { cascade: true, eager: true })
  lines!: PurchaseOrderLine[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
