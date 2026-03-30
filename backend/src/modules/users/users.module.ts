import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LoggingModule } from "../logging/logging.module";
import { AccessControlModule } from "../access-control/access-control.module";

import { User } from "./entities/user.entity";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    LoggingModule,
    forwardRef(() => AccessControlModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

