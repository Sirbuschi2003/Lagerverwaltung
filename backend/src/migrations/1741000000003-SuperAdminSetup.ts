import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Setzt alle MANAGER-Benutzer, die durch die initiale Migration automatisch der
 * Hauptniederlassung zugeordnet wurden, wieder auf branchId = NULL (SUPER_ADMIN).
 *
 * Ein SUPER_ADMIN (branchId = null) sieht alle Niederlassungen und kann alles verwalten.
 * Branch-Manager werden später manuell mit einer Niederlassung verknüpft.
 */
export class SuperAdminSetup1741000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // MANAGER-User die durch initiale Migration auf Hauptniederlassung gesetzt wurden
    // werden zu SUPER_ADMIN (branchId = NULL) zurückgesetzt
    await queryRunner.query(
      `UPDATE \`users\` SET \`branchId\` = NULL
       WHERE \`role\` = 'MANAGER'
         AND \`branchId\` = '00000000-0000-0000-0000-000000000001'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`users\` SET \`branchId\` = '00000000-0000-0000-0000-000000000001'
       WHERE \`role\` = 'MANAGER'
         AND \`branchId\` IS NULL`,
    );
  }
}
