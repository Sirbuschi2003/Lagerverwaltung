import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Branch } from "../../branches/entities/branch.entity";

@Entity({ name: "warehouses" })
export class Warehouse {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** Kurzbezeichnung, z.B. "Teilelager", "Tonerlager" */
  @Column({ type: "varchar", length: 120 })
  name!: string;

  /** Optionaler Kurzcode, z.B. "TEILE", "TONER" */
  @Column({ type: "varchar", length: 20, nullable: true, default: null })
  code!: string | null;

  @Column({ type: "text", nullable: true, default: null })
  description!: string | null;

  @Column({ type: "char", length: 36, nullable: true })
  branchId!: string | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: "RESTRICT", eager: false })
  @JoinColumn({ name: "branchId" })
  branch!: Branch | null;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
