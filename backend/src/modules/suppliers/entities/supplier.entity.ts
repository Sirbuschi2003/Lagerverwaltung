import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "suppliers" })
export class Supplier {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  addressLine1!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  addressLine2!: string | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  postalCode!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  city!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  country!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  contactName!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  email!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  customerNumber!: string | null;

  @Column({ type: "varchar", length: 60, nullable: true })
  phone!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  notes!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
