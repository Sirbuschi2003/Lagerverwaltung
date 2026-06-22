import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeliveryNoteHistory1750000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD COLUMN \`deliveryNoteHistory\` JSON NULL AFTER \`deliveryNoteNumber\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`purchase_orders\` DROP COLUMN \`deliveryNoteHistory\``);
  }
}
