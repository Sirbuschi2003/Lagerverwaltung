import { MigrationInterface, QueryRunner } from "typeorm";

export class AddItemImagePath1740100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `items` ADD `imagePath` varchar(255) NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `items` DROP COLUMN `imagePath`",
    );
  }
}
