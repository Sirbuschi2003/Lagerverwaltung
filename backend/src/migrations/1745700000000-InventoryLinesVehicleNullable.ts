import { MigrationInterface, QueryRunner } from "typeorm";

export class InventoryLinesVehicleNullable1745700000000 implements MigrationInterface {
  name = 'InventoryLinesVehicleNullable1745700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // vehicleId was created as NOT NULL in InitialSchema but the entity declares it nullable.
    // Warehouse inventory sessions (Tonerlager etc.) have no vehicle → this column must allow NULL.
    await queryRunner.query(
      `ALTER TABLE \`inventory_lines\` MODIFY COLUMN \`vehicleId\` char(36) NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting to NOT NULL would destroy warehouse-only inventory lines → only do this in a clean env.
    await queryRunner.query(
      `UPDATE \`inventory_lines\` SET \`vehicleId\` = '' WHERE \`vehicleId\` IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE \`inventory_lines\` MODIFY COLUMN \`vehicleId\` char(36) NOT NULL`
    );
  }
}
