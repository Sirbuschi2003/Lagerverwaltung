import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

import { Item } from "../../items/entities/item.entity";
import { Location } from "../../locations/entities/location.entity";
import { Vehicle } from "../../vehicles/entities/vehicle.entity";

@Entity({ name: "stock_levels" })
@Unique(["item", "location"])
@Index("idx_sl_vehicle", ["vehicle"])
@Index("idx_sl_location", ["location"])
export class StockLevel {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Item, { eager: true, onDelete: "CASCADE" })
  item!: Item;

  @ManyToOne(() => Vehicle, { eager: true, nullable: true, onDelete: "CASCADE" })
  vehicle!: Vehicle | null;

  @ManyToOne(() => Location, { nullable: true, onDelete: "SET NULL" })
  location!: Location | null;

  @Column({ type: "int", default: 0 })
  quantity!: number;

  @Column({ type: "int", default: 0 })
  targetQuantity!: number;

  @UpdateDateColumn()
  updatedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
