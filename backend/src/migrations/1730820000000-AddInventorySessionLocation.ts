import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInventorySessionLocation1730820000000 implements MigrationInterface {
  name = "AddInventorySessionLocation1730820000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const extractRows = (raw: any): any[] => {
      if (Array.isArray(raw)) {
        if (raw.length > 0 && Array.isArray(raw[0])) return raw[0];
        return raw;
      }
      return [];
    };

    const hasColumn =
      extractRows(
        await queryRunner.query(
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_sessions' AND COLUMN_NAME = 'location' LIMIT 1`,
        ),
      ).length > 0;

    if (!hasColumn) {
      await queryRunner.query(
        "ALTER TABLE `inventory_sessions` ADD `location` varchar(255) NULL",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `inventory_sessions` DROP COLUMN `location`",
    );
  }
}
