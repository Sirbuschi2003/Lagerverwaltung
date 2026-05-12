import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";

interface DatabaseEnvironmentConfig {
  host: string;
  port?: number | string;
  user: string;
  password: string;
  name: string;
  synchronize?: boolean;
  migrationsRun?: boolean;
  poolSize?: number | string;
}

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const database = this.configService.get<DatabaseEnvironmentConfig>("database");
    if (!database) {
      throw new Error("Database configuration is missing");
    }

    const normalizedPort =
      typeof database.port === "string" ? Number.parseInt(database.port, 10) : database.port ?? 3306;

    const poolSize =
      typeof database.poolSize === "string"
        ? Number.parseInt(database.poolSize, 10)
        : database.poolSize ?? 30;

    return {
      type: "mysql",
      host: database.host,
      port: normalizedPort,
      username: database.user,
      password: database.password,
      database: database.name,
      autoLoadEntities: true,
      synchronize: database.synchronize ?? false,
      migrationsRun: false, // Migrationen werden manuell in main.ts nach Pre-Migration-Backup ausgeführt
      migrations: ["dist/migrations/*.js"],
      charset: "utf8mb4",
      logging: ["error", "warn"],
      poolSize,
      extra: {
        connectionLimit: poolSize,
        waitForConnections: true,
        queueLimit: 0,
        connectTimeout: 10_000,
      },
    };
  }
}
