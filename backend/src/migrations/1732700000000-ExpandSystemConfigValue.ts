import { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandSystemConfigValue1732700000000 implements MigrationInterface {
  name = "ExpandSystemConfigValue1732700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const extractRows = (raw: any): any[] => {
      if (Array.isArray(raw)) {
        if (raw.length > 0 && Array.isArray(raw[0])) return raw[0];
        return raw;
      }
      return [];
    };

    const rows = extractRows(
      await queryRunner.query(
        `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_config' AND COLUMN_NAME = 'value' LIMIT 1`,
      ),
    );
    const currentType = rows[0]?.DATA_TYPE?.toString().toLowerCase();

    if (currentType !== "longtext") {
      await queryRunner.query(`ALTER TABLE \`system_config\` MODIFY \`value\` LONGTEXT NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`system_config\` MODIFY \`value\` TEXT NULL`);
  }
}
