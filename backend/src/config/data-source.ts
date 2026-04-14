import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'path';

// Load environment variables for CLI usage
config();

const configService = new ConfigService();
const isTs = __filename.endsWith('.ts');

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get('DB_PORT', 3306),
  username: configService.get('DB_USER', 'root'),
  password: configService.get('DB_PASSWORD', ''),
  database: configService.get('DB_NAME', 'lagerverwaltung'),
  entities: [
    isTs
      ? join(__dirname, '..', '**', '*.entity.ts')
      : join(__dirname, '..', '**', '*.entity.js'),
  ],
  migrations: [
    isTs
      ? join(__dirname, '..', 'migrations', '*.ts')
      : join(__dirname, '..', 'migrations', '*.js'),
  ],
  synchronize: false,
  logging: true,
  charset: 'utf8mb4',
  extra: {
    connectionLimit: 10,
  },
});
