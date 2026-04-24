import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssignedUserToInventorySession1745500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`inventory_sessions\` ADD COLUMN \`assignedUserId\` char(36) NULL DEFAULT NULL`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`inventory_sessions\` DROP COLUMN \`assignedUserId\``
    );
  }
}
