import { Column, Entity, PrimaryGeneratedColumn, Index } from "typeorm";

@Entity({ name: "permissions" })
export class Permission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: "perm_key", type: "varchar", length: 150 })
  key!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description!: string | null;
}
