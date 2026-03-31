import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import configuration from "./config/configuration";
import { DatabaseConfigService } from "./config/database-config.service";
import { AuthModule } from "./modules/auth/auth.module";
import { EmailModule } from "./modules/email/email.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { ItemsModule } from "./modules/items/items.module";
import { LoggingModule } from "./modules/logging/logging.module";
import { AccessControlModule } from "./modules/access-control/access-control.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { SetupModule } from "./modules/setup/setup.module";
import { StockModule } from "./modules/stock/stock.module";
import { SystemConfigModule } from "./modules/system-config/system-config.module";
import { UsersModule } from "./modules/users/users.module";
import { VehiclesModule } from "./modules/vehicles/vehicles.module";
import { DatabaseModule } from "./modules/database/database.module";
import { LocationsModule } from "./modules/locations/locations.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { PurchasingModule } from "./modules/purchasing/purchasing.module";
import { UpdateModule } from "./modules/update/update.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [".env", ".env.local"],
    }),
    // Globales Rate-Limiting: 100 Anfragen pro Minute (ueberschreibbar per @Throttle())
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfigService,
    }),
    DatabaseModule,
    AuthModule,
    EmailModule,
    InventoryModule,
    ItemsModule,
    LoggingModule,
    AccessControlModule,
    NotificationsModule,
    ReportsModule,
    SetupModule,
    StockModule,
    SystemConfigModule,
    UsersModule,
    VehiclesModule,
    LocationsModule,
    SuppliersModule,
    PurchasingModule,
    UpdateModule,
    MaintenanceModule,
  ],
  controllers: [AppController],
  providers: [
    // ThrottlerGuard global aktivieren (ueberschreibbar per @SkipThrottle())
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
