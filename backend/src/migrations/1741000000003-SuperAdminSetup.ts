import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Macht users.branchId nullable (SUPER_ADMIN = branchId NULL) und setzt alle
 * MANAGER-Benutzer der Hauptniederlassung zurück auf branchId = NULL.
 */
export class SuperAdminSetup1741000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. FK droppen (nötig für MODIFY)
    await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_users_branch\``);

    // 2. branchId in users wieder nullable machen (SUPER_ADMIN darf NULL haben)
    await queryRunner.query(`ALTER TABLE \`users\` MODIFY \`branchId\` char(36) NULL DEFAULT NULL`);

    // 3. FK neu anlegen (nullable)
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_users_branch\` FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT`,
    );

    // 4. Alle MANAGER der Hauptniederlassung → SUPER_ADMIN (branchId = NULL)
    await queryRunner.query(
      `UPDATE \`users\` SET \`branchId\` = NULL
       WHERE \`role\` = 'MANAGER'
         AND \`branchId\` = '00000000-0000-0000-0000-000000000001'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`users\` SET \`branchId\` = '00000000-0000-0000-0000-000000000001'
       WHERE \`role\` = 'MANAGER' AND \`branchId\` IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_users_branch\``);
    await queryRunner.query(`ALTER TABLE \`users\` MODIFY \`branchId\` char(36) NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_users_branch\` FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT`,
    );
  }
}
