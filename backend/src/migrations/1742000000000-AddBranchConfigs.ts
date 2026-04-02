import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Erstellt branch_configs-Tabelle für niederlassungsspezifische Konfigurationsüberschreibungen.
 * Firmendaten, E-Mail-Einstellungen und Lagereinstellungen können damit pro Niederlassung
 * individuell konfiguriert werden; global (system_config) dient als Fallback.
 */
export class AddBranchConfigs1742000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables: Array<{ TABLE_NAME: string }> = await queryRunner.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_configs'`,
    );
    if (tables.length > 0) return; // idempotent

    await queryRunner.query(`
      CREATE TABLE \`branch_configs\` (
        \`id\`          int NOT NULL AUTO_INCREMENT,
        \`branchId\`    char(36) NOT NULL,
        \`key\`         varchar(100) NOT NULL,
        \`value\`       longtext NULL,
        \`description\` text NULL,
        \`isSecret\`    tinyint(1) NOT NULL DEFAULT 0,
        \`createdAt\`   datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`   datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_branch_config\` (\`branchId\`, \`key\`),
        KEY \`idx_branch_config_branchId\` (\`branchId\`),
        CONSTRAINT \`FK_branch_configs_branch\`
          FOREIGN KEY (\`branchId\`) REFERENCES \`branches\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`branch_configs\``);
  }
}
