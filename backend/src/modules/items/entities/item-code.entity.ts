import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { Branch } from "../../branches/entities/branch.entity";
import { Item } from "./item.entity";

export const ITEM_CODE_KINDS = ["ALIAS", "OEM", "SUPPLIER"] as const;
export type ItemCodeKind = (typeof ITEM_CODE_KINDS)[number];

@Entity({ name: "item_codes" })
@Index("IDX_item_codes_branch_code", ["branchId", "code"], { unique: true })
export class ItemCode {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "char", length: 36 })
  branchId!: string;

  @ManyToOne(() => Branch, { nullable: false, onDelete: "CASCADE", eager: false })
  @JoinColumn({ name: "branchId" })
  branch!: Branch;

  @Column({ type: "varchar", length: 120 })
  code!: string;

  @Column({ type: "varchar", length: 32, default: "ALIAS" })
  kind!: ItemCodeKind;

  @ManyToOne(() => Item, (item) => item.codes, { onDelete: "CASCADE" })
  item!: Item;
}
