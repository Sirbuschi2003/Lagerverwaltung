import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from "typeorm";

import { Item } from "../../items/entities/item.entity";
import { Location } from "../../locations/entities/location.entity";
import { User } from "../../users/entities/user.entity";
import { Vehicle } from "../../vehicles/entities/vehicle.entity";

import { StockLevel } from "./stock-level.entity";

export const RESTOCK_REQUEST_STATUSES = ["PENDING", "APPROVED", "FULFILLED", "CANCELLED"] as const;
export type RestockRequestStatus = (typeof RESTOCK_REQUEST_STATUSES)[number];

@Entity({ name: "restock_requests" })
export class RestockRequest {
  @PrimaryGeneratedColumn("uuid")
  id!: string;


  @ManyToOne(() => StockLevel, { eager: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "stockLevelId" })
  stockLevel!: StockLevel;

  @Column({ type: "char", length: 36 })
  stockLevelId!: string;

  @ManyToOne(() => Item, { eager: false, onDelete: "CASCADE" })
  item!: Item;

  @ManyToOne(() => Vehicle, { eager: false, onDelete: "CASCADE" })
  vehicle!: Vehicle;

  @ManyToOne(() => Location, { eager: false, nullable: true, onDelete: "SET NULL" })
  location!: Location | null;

  @Index()
  @Column({ type: "enum", enum: RESTOCK_REQUEST_STATUSES, default: "PENDING" })
  status!: RestockRequestStatus;


  @Column({ type: "int" })
  quantityNeeded!: number;

  @Column({ type: "int", nullable: true, default: null })
  quantityProvided!: number | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  note!: string | null;

  @ManyToOne(() => User, { eager: false, nullable: true, onDelete: "SET NULL" })
  preparedBy!: User | null;

  @Column({ type: "timestamp", nullable: true })
  readyAt!: Date | null;

  @Column({ type: "timestamp", nullable: true })
  fulfilledAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
