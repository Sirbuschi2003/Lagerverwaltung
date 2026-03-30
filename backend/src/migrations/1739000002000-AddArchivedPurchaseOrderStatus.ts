import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArchivedPurchaseOrderStatus1739000002000 implements MigrationInterface {
  name = "AddArchivedPurchaseOrderStatus1739000002000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders
      MODIFY COLUMN status enum('DRAFT','ORDERED','RECEIVED','CANCELLED','ARCHIVED')
      NOT NULL DEFAULT 'DRAFT'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE purchase_orders
      SET status = 'CANCELLED'
      WHERE status = 'ARCHIVED'
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_orders
      MODIFY COLUMN status enum('DRAFT','ORDERED','RECEIVED','CANCELLED')
      NOT NULL DEFAULT 'DRAFT'
    `);
  }
}
