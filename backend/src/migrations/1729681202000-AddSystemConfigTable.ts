import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSystemConfigTable1729681202000 implements MigrationInterface {
  name = "AddSystemConfigTable1729681202000";

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
        `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_config' LIMIT 1`,
      ),
    ).length > 0;

    if (!tableExists) {
      await queryRunner.query(`
        CREATE TABLE \`system_config\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`key\` varchar(100) NOT NULL,
          \`value\` text NULL,
          \`description\` text NULL,
          \`isSecret\` tinyint NOT NULL DEFAULT 0,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_SYSTEM_CONFIG_KEY\` (\`key\`)
        ) ENGINE=InnoDB
      `);

      await queryRunner.query(`
        INSERT INTO \`system_config\` (\`key\`, \`value\`, \`description\`) VALUES
        ('log.minimumLevel', 'INFO', 'Minimum Log-Level fuer System-Logs'),
        ('email.configured', 'false', 'Email-Service konfiguriert')
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`UQ_SYSTEM_CONFIG_KEY\` ON \`system_config\``);
    await queryRunner.query(`DROP TABLE \`system_config\``);
  }
}
