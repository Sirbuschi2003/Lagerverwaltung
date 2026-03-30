import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Permission } from "./entities/permission.entity";
import { Role } from "./entities/role.entity";
import { RolePermission } from "./entities/role-permission.entity";
import { UserPermission } from "./entities/user-permission.entity";
import { AccessControlService } from "./access-control.service";
import { AccessControlController } from "./access-control.controller";
import { PermissionsGuard } from "./guards/permissions.guard";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [TypeOrmModule.forFeature([Permission, Role, RolePermission, UserPermission]), forwardRef(() => UsersModule)],
  providers: [AccessControlService, PermissionsGuard],
  controllers: [AccessControlController],
  exports: [AccessControlService, PermissionsGuard],
})
export class AccessControlModule {}
