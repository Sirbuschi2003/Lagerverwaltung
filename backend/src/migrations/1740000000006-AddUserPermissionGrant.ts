import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserPermissionGrant1740000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE user_permissions ADD COLUMN \`grant\` TINYINT(1) NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE user_permissions DROP COLUMN \`grant\``,
    );
  }
}
