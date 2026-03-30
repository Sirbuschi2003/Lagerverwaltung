import { Column, Entity, PrimaryGeneratedColumn, Unique, ManyToOne, JoinColumn } from "typeorm";
import { Role } from "./role.entity";
import { Permission } from "./permission.entity";

@Entity({ name: "role_permissions" })
@Unique(["roleId", "permissionId"])
export class RolePermission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  roleId!: number;

  @Column()
  permissionId!: number;

  @ManyToOne(() => Role, { onDelete: "CASCADE" })
  @JoinColumn({ name: "roleId" })
  role!: Role;

  @ManyToOne(() => Permission, { onDelete: "CASCADE" })
  @JoinColumn({ name: "permissionId" })
  permission!: Permission;
}
