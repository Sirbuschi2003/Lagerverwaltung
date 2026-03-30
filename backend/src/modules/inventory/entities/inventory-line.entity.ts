import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { Item } from "../../items/entities/item.entity";
import { Vehicle } from "../../vehicles/entities/vehicle.entity";
import { Location } from "../../locations/entities/location.entity";

import { InventorySession } from "./inventory-session.entity";

@Entity({ name: "inventory_lines" })
export class InventoryLine {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => InventorySession, (session) => session.lines, {
    onDelete: "CASCADE",
  })
  session!: InventorySession;

  @ManyToOne(() => Item, { eager: true, onDelete: "CASCADE" })
  item!: Item;

  @ManyToOne(() => Vehicle, { eager: true, nullable: true, onDelete: "SET NULL" })
  vehicle!: Vehicle | null;

  @ManyToOne(() => Location, { nullable: true, onDelete: "SET NULL" })
  location!: Location | null;

  @Column({ type: "int" })
  countedQuantity!: number;

  @Column({ type: "int" })
  expectedQuantity!: number;

  @Column({ type: "int", nullable: true })
  bookedDelta!: number | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  note!: string | null;
}
