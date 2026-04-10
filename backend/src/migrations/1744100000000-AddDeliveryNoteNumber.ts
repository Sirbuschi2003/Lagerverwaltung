import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeliveryNoteNumber1744100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE purchase_orders ADD COLUMN deliveryNoteNumber VARCHAR(128) NULL AFTER note`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE purchase_orders DROP COLUMN deliveryNoteNumber`);
  }
}
