import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AccessControlModule } from "../access-control/access-control.module";
import { EmailModule } from "../email/email.module";
import { LoggingModule } from "../logging/logging.module";
import { UsersModule } from "../users/users.module";

import { User } from "../users/entities/user.entity";

import { AuthCleanupService } from "./auth-cleanup.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordHistory } from "./entities/password-history.entity";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { RefreshToken } from "./entities/refresh-token.entity";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PasswordResetToken, PasswordHistory, RefreshToken, User]),
    UsersModule,
    AccessControlModule,
    LoggingModule,
    EmailModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("auth.jwtSecret"),
        signOptions: { expiresIn: configService.get<string>("auth.jwtExpiresIn") },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthCleanupService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, AuthCleanupService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
