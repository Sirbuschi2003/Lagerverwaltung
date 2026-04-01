import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Macht users.branchId nullable (SUPER_ADMIN = branchId NULL) und setzt alle
 * MANAGER-Benutzer der Hauptniederlassung zurück auf branchId = NULL.
 *
 * Defensive Implementierung: prüft per INFORMATION_SCHEMA ob FK/Constraint bereits
 * geändert wurde (bei Partial-Runs nach Crash-Loop idempotent).
 */
export class SuperAdminSetup1741000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. FK droppen – nur wenn er noch existiert
    const fkRows: Array<{ CONSTRAINT_NAME: string }> = await queryRunner.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'
         AND CONSTRAINT_NAME = 'FK_users_branch'`,
    );
    if (fkRows.length > 0) {
      await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_users_branch\``);
    }

    // 2. branchId nullable machen – nur wenn Spalte noch NOT NULL ist
    const colRows: Array<{ IS_NULLABLE: string }> = await queryRunner.query(
      `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'branchId'`,
    );
    if (colRows.length > 0 && colRows[0].IS_NULLABLE === "NO") {
      await queryRunner.query(
        `ALTER TABLE \`users\` CHANGE COLUMN \`branchId\` \`branchId\` char(36) NULL DEFAULT NULL`,
      );
    }

    // 3. FK neu anlegen – nur wenn er noch nicht existiert
    const fkAfterRows: Array<{ CONSTRAINT_NAME: string }> = await queryRunner.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'
         AND CONSTRAINT_NAME = 'FK_users_branch'`,
    );
    if (fkAfterRows.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_users_branch\` FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT`,
      );
    }

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
