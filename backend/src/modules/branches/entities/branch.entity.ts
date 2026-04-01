import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "branches" })
export class Branch {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** Externe Niederlassungsnummer (z.B. 400 = Hannover, 100 = Essen) */
  @Index({ unique: true, where: "`externalCode` IS NOT NULL" })
  @Column({ type: "varchar", length: 20, nullable: true, default: null })
  externalCode!: string | null;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "text", nullable: true, default: null })
  address!: string | null;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
