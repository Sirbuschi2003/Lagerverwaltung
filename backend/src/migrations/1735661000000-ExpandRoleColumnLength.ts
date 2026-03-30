import { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandRoleColumnLength1735661000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY COLUMN \`role\` VARCHAR(255) NOT NULL DEFAULT 'TECHNICIAN'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY COLUMN \`role\` VARCHAR(120) NOT NULL DEFAULT 'TECHNICIAN'`
    );
  }
}
