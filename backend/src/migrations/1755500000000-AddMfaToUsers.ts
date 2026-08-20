import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMfaToUsers1755500000000 implements MigrationInterface {
  name = "AddMfaToUsers1755500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` ADD COLUMN \`mfaEnabled\` tinyint NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE \`users\` ADD COLUMN \`mfaTotpSecret\` varchar(64) NULL DEFAULT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`mfaTotpSecret\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`mfaEnabled\``);
  }
}
