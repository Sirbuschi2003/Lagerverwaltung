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

    return {
      type: "mysql",
      host: database.host,
      port: normalizedPort,
      username: database.user,
      password: database.password,
      database: database.name,
      autoLoadEntities: true,
      synchronize: database.synchronize ?? false,
      migrationsRun: database.migrationsRun ?? true,
      migrations: ["dist/migrations/*.js"],
      charset: "utf8mb4",
      logging: ["error", "warn"],
    };
  }
}
