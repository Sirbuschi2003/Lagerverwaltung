import { Column, Entity, PrimaryGeneratedColumn, Unique, ManyToOne, JoinColumn } from "typeorm";
import { Permission } from "./permission.entity";
import { User } from "../../users/entities/user.entity";

@Entity({ name: "user_permissions" })
@Unique(["userId", "permissionId"])
export class UserPermission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "char", length: 36 })
  userId!: string;

  @Column()
  permissionId!: number;

  /** true = GRANT (Override), false = DENY (Entzug trotz Rollenrecht) */
  @Column({ type: "boolean", default: true })
  grant!: boolean;

  @ManyToOne(() => Permission, { onDelete: "CASCADE" })
  @JoinColumn({ name: "permissionId" })
  permission!: Permission;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;
}
