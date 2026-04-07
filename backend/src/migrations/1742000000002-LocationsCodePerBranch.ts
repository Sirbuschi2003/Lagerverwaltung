import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Ändert den Unique-Index auf locations(parent, code) zu (branchId, parent, code),
 * damit verschiedene Niederlassungen dieselben Lagerorte-Codes verwenden können.
 * Idempotent: prüft vor jedem Schritt den aktuellen Zustand.
 */
export class LocationsCodePerBranch1742000000002 implements MigrationInterface {
  private async indexExists(queryRunner: QueryRunner, table: string, indexName: string): Promise<boolean> {
    const rows: any[] = await queryRunner.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, indexName],
    );
    return Number(rows[0]?.cnt ?? 0) > 0;
  }

  private async fkExists(queryRunner: QueryRunner, table: string, fkName: string): Promise<boolean> {
    const rows: any[] = await queryRunner.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
      [table, fkName],
    );
    return Number(rows[0]?.cnt ?? 0) > 0;
  }

  private async findFkOnColumn(queryRunner: QueryRunner, table: string, column: string): Promise<string | null> {
    const rows: Array<{ CONSTRAINT_NAME: string }> = await queryRunner.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL
       LIMIT 1`,
      [table, column],
    );
    return rows.length > 0 ? rows[0].CONSTRAINT_NAME : null;
  }

  private async findOldParentCodeIndex(queryRunner: QueryRunner): Promise<string | null> {
    // Sucht einen Unique-Index auf locations der parentId UND code enthält,
    // aber NICHT branchId (also den alten globalen Index)
    const rows: Array<{ INDEX_NAME: string }> = await queryRunner.query(
      `SELECT DISTINCT s1.INDEX_NAME
       FROM INFORMATION_SCHEMA.STATISTICS s1
       WHERE s1.TABLE_SCHEMA = DATABASE()
         AND s1.TABLE_NAME = 'locations'
         AND s1.NON_UNIQUE = 0
         AND s1.INDEX_NAME != 'PRIMARY'
         AND s1.INDEX_NAME != 'IDX_locations_branch_parent_code'
         AND s1.COLUMN_NAME IN ('parentId', 'code')
         AND NOT EXISTS (
           SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS s2
           WHERE s2.TABLE_SCHEMA = DATABASE()
             AND s2.TABLE_NAME = 'locations'
             AND s2.INDEX_NAME = s1.INDEX_NAME
             AND s2.COLUMN_NAME = 'branchId'
         )`,
    );
    return rows.length > 0 ? rows[0].INDEX_NAME : null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Alten (parent, code) Unique-Index suchen
    const oldIdx = await this.findOldParentCodeIndex(queryRunner);

    if (oldIdx) {
      // 2. FK auf parentId temporär droppen damit der Index gelöscht werden kann
      const fkName = await this.findFkOnColumn(queryRunner, "locations", "parentId");
      if (fkName) {
        await queryRunner.query(`ALTER TABLE \`locations\` DROP FOREIGN KEY \`${fkName}\``);
      }

      // 3. Alten Index droppen
      await queryRunner.query(`DROP INDEX \`${oldIdx}\` ON \`locations\``);

      // 4. FK wieder anlegen
      if (fkName && !(await this.fkExists(queryRunner, "locations", fkName))) {
        await queryRunner.query(
          `ALTER TABLE \`locations\` ADD CONSTRAINT \`${fkName}\`
           FOREIGN KEY (\`parentId\`) REFERENCES \`locations\`(\`id\`) ON DELETE SET NULL`,
        );
      }
    }

    // 5. Neuen (branchId, parentId, code) Unique-Index anlegen
    if (!(await this.indexExists(queryRunner, "locations", "IDX_locations_branch_parent_code"))) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX \`IDX_locations_branch_parent_code\`
         ON \`locations\` (\`branchId\`, \`parentId\`, \`code\`)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.indexExists(queryRunner, "locations", "IDX_locations_branch_parent_code")) {
      await queryRunner.query(`DROP INDEX \`IDX_locations_branch_parent_code\` ON \`locations\``);
    }
    if (!(await this.indexExists(queryRunner, "locations", "IDX_locations_parent_code"))) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX \`IDX_locations_parent_code\` ON \`locations\` (\`parentId\`, \`code\`)`,
      );
    }
  }
}
