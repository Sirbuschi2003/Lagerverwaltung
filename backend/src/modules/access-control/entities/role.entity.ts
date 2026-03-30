import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "roles" })
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description!: string | null;

  @Column({ type: "boolean", default: false, name: "is_system" })
  isSystem!: boolean;
}
