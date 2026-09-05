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

  // §240 HGB / GoBD GOB-003: Einstandspreise für Bestandsbewertung
  @Column({ name: "unit_price_net", type: "decimal", precision: 12, scale: 4, nullable: true })
  unitPriceNet!: number | null;

  @Column({ name: "tax_rate", type: "decimal", precision: 5, scale: 2, nullable: true, default: 19.0 })
  taxRate!: number | null;

  @Column({ type: "varchar", length: 3, default: "EUR" })
  currency!: string;

  get lineTotalNet(): number | null {
    if (this.unitPriceNet == null) return null;
    return Math.round(this.quantity * Number(this.unitPriceNet) * 10000) / 10000;
  }

  get lineTotalGross(): number | null {
    if (this.unitPriceNet == null) return null;
    const net = this.quantity * Number(this.unitPriceNet);
    const tax = (this.taxRate != null ? Number(this.taxRate) : 19) / 100;
    return Math.round(net * (1 + tax) * 10000) / 10000;
  }
}
