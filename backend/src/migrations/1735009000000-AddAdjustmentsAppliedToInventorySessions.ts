import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdjustmentsAppliedToInventorySessions1735009000000 implements MigrationInterface {
  name = "AddAdjustmentsAppliedToInventorySessions1735009000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory_sessions
      ADD COLUMN adjustmentsApplied BOOLEAN NOT NULL DEFAULT FALSE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory_sessions
      DROP COLUMN adjustmentsApplied
    `);
  }
}
