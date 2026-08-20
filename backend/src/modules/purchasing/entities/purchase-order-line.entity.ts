import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { Item } from "../../items/entities/item.entity";
import { PurchaseOrder } from "./purchase-order.entity";

@Entity({ name: "purchase_order_lines" })
export class PurchaseOrderLine {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => PurchaseOrder, (order) => order.lines, { onDelete: "CASCADE" })
  order!: PurchaseOrder;

  @ManyToOne(() => Item, { eager: false, onDelete: "RESTRICT" })
  item!: Item;

  @Column({ type: "int" })
  quantity!: number;

  @Column({ type: "int", default: 0 })
  receivedQuantity!: number;

  @Column({ type: "int", nullable: true })
  packSize!: number | null;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;
}
