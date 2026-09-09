import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";

import { WsJwtGuard } from "../../common/guards/ws-jwt.guard";
import { AccessControlModule } from "../access-control/access-control.module";
import { InventorySession } from "../inventory/entities/inventory-session.entity";
import { ItemsModule } from "../items/items.module";
import { LocationsModule } from "../locations/locations.module";
import { LoggingModule } from "../logging/logging.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { VehiclesModule } from "../vehicles/vehicles.module";

import { RestockRequest } from "./entities/restock-request.entity";
import { StockLevel } from "./entities/stock-level.entity";
import { StockMovement } from "./entities/stock-movement.entity";
import { MovementQueryService } from "./movement-query.service";
import { StockAdminController } from "./stock-admin.controller";
import { StockDiagnosticsService } from "./stock-diagnostics.service";
import { StockController } from "./stock.controller";
import { StockGateway } from "./stock.gateway";
import { StockService } from "./stock.service";

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("auth.jwtSecret"),
        signOptions: { expiresIn: configService.get<string>("auth.jwtExpiresIn") },
      }),
    }),
    TypeOrmModule.forFeature([StockLevel, StockMovement, RestockRequest, InventorySession]),
    ItemsModule,
    LoggingModule,
    AccessControlModule,
    NotificationsModule,
    UsersModule,
    VehiclesModule,
    LocationsModule,
  ],
  controllers: [StockController, StockAdminController],
  providers: [StockService, StockGateway, StockDiagnosticsService, MovementQueryService, WsJwtGuard],
  exports: [StockService, StockDiagnosticsService, MovementQueryService],
})
export class StockModule {}
