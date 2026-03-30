import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Passwort-Historie: Verhindert Wiederverwendung der letzten 5 Passwörter.
 */
export class AddPasswordHistory1740000000005 implements MigrationInterface {
  name = "AddPasswordHistory1740000000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`password_history\` (
        \`id\` varchar(36) NOT NULL,
        \`passwordHash\` varchar(255) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`userId\` varchar(36) NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_ph_user_created\` (\`userId\`, \`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      ALTER TABLE \`password_history\`
        ADD CONSTRAINT \`fk_ph_user\`
        FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`password_history\``);
  }
}
