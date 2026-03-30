import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { Item } from "./item.entity";

export const ITEM_CODE_KINDS = ["ALIAS", "OEM", "SUPPLIER"] as const;
export type ItemCodeKind = (typeof ITEM_CODE_KINDS)[number];

@Entity({ name: "item_codes" })
export class ItemCode {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 120 })
  code!: string;

  @Column({ type: "varchar", length: 32, default: "ALIAS" })
  kind!: ItemCodeKind;

  @ManyToOne(() => Item, (item) => item.codes, { onDelete: "CASCADE" })
  item!: Item;
}
