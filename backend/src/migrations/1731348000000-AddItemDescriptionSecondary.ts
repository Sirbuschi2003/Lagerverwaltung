import { MigrationInterface, QueryRunner } from "typeorm";

export class AddItemDescriptionSecondary1731348000000 implements MigrationInterface {
  name = "AddItemDescriptionSecondary1731348000000";

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
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'descriptionSecondary' LIMIT 1`,
        ),
      ).length > 0;

    if (!hasColumn) {
      await queryRunner.query(
        "ALTER TABLE `items` ADD `descriptionSecondary` varchar(255) NULL",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `items` DROP COLUMN `descriptionSecondary`",
    );
  }
}
