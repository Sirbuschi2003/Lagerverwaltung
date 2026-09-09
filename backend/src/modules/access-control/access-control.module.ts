import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LoggingModule } from "../logging/logging.module";
import { UsersModule } from "../users/users.module";

import { AccessControlController } from "./access-control.controller";
import { AccessControlService } from "./access-control.service";
import { Permission } from "./entities/permission.entity";
import { RolePermission } from "./entities/role-permission.entity";
import { Role } from "./entities/role.entity";
import { UserPermission } from "./entities/user-permission.entity";
import { PermissionsGuard } from "./guards/permissions.guard";


@Module({
  imports: [TypeOrmModule.forFeature([Permission, Role, RolePermission, UserPermission]), forwardRef(() => UsersModule), LoggingModule],
  providers: [AccessControlService, PermissionsGuard],
  controllers: [AccessControlController],
  exports: [AccessControlService, PermissionsGuard],
})
export class AccessControlModule {}
