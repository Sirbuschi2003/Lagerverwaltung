import { MigrationInterface, QueryRunner } from "typeorm";

export class AddItemStockThresholds1740000000001 implements MigrationInterface {
  name = "AddItemStockThresholds1740000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`items\` ADD \`minimumStock\` int NULL DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE \`items\` ADD \`reorderPoint\` int NULL DEFAULT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`items\` DROP COLUMN \`reorderPoint\``);
    await queryRunner.query(`ALTER TABLE \`items\` DROP COLUMN \`minimumStock\``);
  }
}
