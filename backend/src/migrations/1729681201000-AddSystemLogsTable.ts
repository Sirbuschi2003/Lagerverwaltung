import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemLogsTable1729681201000 implements MigrationInterface {
  name = 'AddSystemLogsTable1729681201000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const extractRows = (raw: any): any[] => {
      if (Array.isArray(raw)) {
        if (raw.length > 0 && Array.isArray(raw[0])) return raw[0];
        return raw;
      }
      return [];
    };

    const tableExists = extractRows(
      await queryRunner.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_logs' LIMIT 1`,
      ),
    ).length > 0;

    if (!tableExists) {
      await queryRunner.query(`
        CREATE TABLE \`system_logs\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`level\` enum('DEBUG', 'INFO', 'WARNING', 'ERROR', 'SECURITY') NOT NULL DEFAULT 'INFO',
          \`category\` enum('AUTH', 'STOCK', 'VEHICLE', 'RESTOCK', 'USER', 'SYSTEM', 'INVENTORY') NOT NULL,
          \`action\` varchar(255) NOT NULL,
          \`details\` text NULL,
          \`metadata\` json NULL,
          \`userId\` varchar(255) NULL,
          \`ipAddress\` varchar(45) NULL,
          \`userAgent\` varchar(500) NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_SYSTEM_LOGS_LEVEL\` (\`level\`),
          INDEX \`IDX_SYSTEM_LOGS_CATEGORY\` (\`category\`),
          INDEX \`IDX_SYSTEM_LOGS_USER_ID\` (\`userId\`),
          INDEX \`IDX_SYSTEM_LOGS_CREATED_AT\` (\`createdAt\`)
        ) ENGINE=InnoDB
      `);
    }

    const fkExists = extractRows(
      await queryRunner.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'FK_SYSTEM_LOGS_USER' LIMIT 1`,
      ),
    ).length > 0;

    if (!fkExists) {
      await queryRunner.query(`
        ALTER TABLE \`system_logs\` 
        ADD CONSTRAINT \`FK_SYSTEM_LOGS_USER\` 
        FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) 
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`system_logs\` DROP FOREIGN KEY \`FK_SYSTEM_LOGS_USER\``);
    await queryRunner.query(`DROP TABLE \`system_logs\``);
  }
}
