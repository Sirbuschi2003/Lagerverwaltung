import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Ändert den Unique-Index auf locations(parent, code) zu (branchId, parent, code),
 * damit verschiedene Niederlassungen dieselben Lagerorte-Codes verwenden können.
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

  private async findIndexOnColumns(queryRunner: QueryRunner, table: string, columns: string[]): Promise<string | null> {
    // Findet einen Index der genau diese Spalten enthält (in beliebiger Reihenfolge)
    for (const col of columns) {
      const rows: Array<{ INDEX_NAME: string }> = await queryRunner.query(
        `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
           AND INDEX_NAME != 'PRIMARY'
           AND NON_UNIQUE = 0`,
        [table, col],
      );
      for (const row of rows) {
        const idxName = row.INDEX_NAME;
        if (idxName === "IDX_locations_branch_parent_code") continue;
        // Prüfe ob dieser Index alle gesuchten Spalten enthält
        const colRows: Array<{ COLUMN_NAME: string }> = await queryRunner.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          [table, idxName],
        );
        const colNames = colRows.map((r) => r.COLUMN_NAME);
        if (columns.every((c) => colNames.includes(c)) && colNames.length === columns.length) {
          return idxName;
        }
      }
    }
    return null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Alten (parent, code) Unique-Index entfernen
    const oldIdx = await this.findIndexOnColumns(queryRunner, "locations", ["parentId", "code"]);
    if (oldIdx) {
      await queryRunner.query(`DROP INDEX \`${oldIdx}\` ON \`locations\``);
    }

    // 2. Neuen (branchId, parentId, code) Unique-Index anlegen
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
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_locations_parent_code\` ON \`locations\` (\`parentId\`, \`code\`)`,
    );
  }
}
