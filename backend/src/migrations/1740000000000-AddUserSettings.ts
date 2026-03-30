import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserSettings1740000000000 implements MigrationInterface {
  name = "AddUserSettings1740000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` ADD \`settings\` json NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`settings\``);
  }
}
