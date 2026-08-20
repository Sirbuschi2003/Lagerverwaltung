import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LoggingModule } from "../logging/logging.module";
import { AccessControlModule } from "../access-control/access-control.module";
import { Location } from "../locations/entities/location.entity";
import { PasswordHistory } from "../auth/entities/password-history.entity";
import { RefreshToken } from "../auth/entities/refresh-token.entity";

import { User } from "./entities/user.entity";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Location, PasswordHistory, RefreshToken]),
    LoggingModule,
    forwardRef(() => AccessControlModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
