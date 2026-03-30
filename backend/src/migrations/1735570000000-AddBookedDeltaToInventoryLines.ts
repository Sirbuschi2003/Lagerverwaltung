import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookedDeltaToInventoryLines1735570000000 implements MigrationInterface {
  name = 'AddBookedDeltaToInventoryLines1735570000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory_lines 
      ADD COLUMN bookedDelta INT NULL COMMENT 'Bereits gebuchte Differenz für Delta-Buchungen'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory_lines 
      DROP COLUMN bookedDelta
    `);
  }
}
