import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Macht inventory_sessions.branchId nullable.
 * Super-Admin (branchId = null) hat keine eigene Niederlassung und muss
 * sessionübergreifende Inventuren für alle Niederlassungen anlegen können.
 */
export class InventorySessionBranchNullable1744000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // FK droppen – nur wenn vorhanden
    const fkRows: Array<{ CONSTRAINT_NAME: string }> = await queryRunner.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'inventory_sessions'
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'
         AND CONSTRAINT_NAME = 'FK_inventory_sessions_branch'`,
    );
    if (fkRows.length > 0) {
      await queryRunner.query(
        `ALTER TABLE \`inventory_sessions\` DROP FOREIGN KEY \`FK_inventory_sessions_branch\``,
      );
    }

    // branchId nullable machen – nur wenn noch NOT NULL
    const colRows: Array<{ IS_NULLABLE: string }> = await queryRunner.query(
      `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'inventory_sessions'
         AND COLUMN_NAME = 'branchId'`,
    );
    if (colRows.length > 0 && colRows[0].IS_NULLABLE === "NO") {
      await queryRunner.query(
        `ALTER TABLE \`inventory_sessions\` CHANGE COLUMN \`branchId\` \`branchId\` char(36) NULL DEFAULT NULL`,
      );
    }

    // FK neu anlegen – nur wenn noch nicht vorhanden
    const fkAfterRows: Array<{ CONSTRAINT_NAME: string }> = await queryRunner.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'inventory_sessions'
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'
         AND CONSTRAINT_NAME = 'FK_inventory_sessions_branch'`,
    );
    if (fkAfterRows.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`inventory_sessions\` ADD CONSTRAINT \`FK_inventory_sessions_branch\`
         FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`inventory_sessions\` DROP FOREIGN KEY \`FK_inventory_sessions_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`inventory_sessions\` MODIFY \`branchId\` char(36) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`inventory_sessions\` ADD CONSTRAINT \`FK_inventory_sessions_branch\`
       FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT`,
    );
  }
}
