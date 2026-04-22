import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { Item } from "../../items/entities/item.entity";
import { Location } from "../../locations/entities/location.entity";
import { User } from "../../users/entities/user.entity";
import { Vehicle } from "../../vehicles/entities/vehicle.entity";

export const STOCK_MOVEMENT_TYPES = ["CHECKOUT", "CHECKIN", "ADJUSTMENT"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

@Entity({ name: "stock_movements" })
export class StockMovement {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Item, { eager: true, onDelete: "CASCADE" })
  item!: Item;

  @ManyToOne(() => Vehicle, { eager: true, onDelete: "SET NULL" })
  vehicle!: Vehicle | null;

  @ManyToOne(() => Location, { eager: false, nullable: true, onDelete: "SET NULL" })
  location!: Location | null;

  @ManyToOne(() => User, { eager: true, onDelete: "SET NULL" })
  user!: User | null;

  @Column({ type: "enum", enum: STOCK_MOVEMENT_TYPES })
  type!: StockMovementType;

  @Column({ type: "int" })
  quantity!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  note!: string | null;

  @Column({ type: "varchar", length: 64 })
  source!: string;

  @Column({ type: "timestamp" })
  occurredAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  /**
   * GoBD-Konformität: Buchungen werden NICHT gelöscht, sondern storniert.
   * isVoided=true markiert eine stornierte Buchung (bleibt dauerhaft erhalten).
   */
  @Column({ type: "boolean", default: false })
  isVoided!: boolean;

  @Column({ type: "timestamp", nullable: true })
  voidedAt!: Date | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  voidedBy!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  voidReason!: string | null;
}
