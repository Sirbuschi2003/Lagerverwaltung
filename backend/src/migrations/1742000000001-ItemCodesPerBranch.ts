import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fügt branchId zur item_codes-Tabelle hinzu und ändert den Unique-Index
 * von global (code) auf per-Branch (branchId, code).
 * Idempotent: prüft vor jedem Schritt ob er bereits durchgeführt wurde.
 */
export class ItemCodesPerBranch1742000000001 implements MigrationInterface {
  private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const rows: any[] = await queryRunner.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return Number(rows[0]?.cnt ?? 0) > 0;
  }

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

  private async findGlobalUniqueOnCode(queryRunner: QueryRunner): Promise<string | null> {
    const rows: Array<{ INDEX_NAME: string }> = await queryRunner.query(
      `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'item_codes'
         AND NON_UNIQUE = 0
         AND INDEX_NAME != 'PRIMARY'
         AND INDEX_NAME != 'IDX_item_codes_branch_code'
       LIMIT 1`,
    );
    return rows.length > 0 ? rows[0].INDEX_NAME : null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. branchId-Spalte hinzufügen (falls noch nicht vorhanden)
    if (!(await this.columnExists(queryRunner, "item_codes", "branchId"))) {
      await queryRunner.query(
        `ALTER TABLE \`item_codes\` ADD COLUMN \`branchId\` char(36) NULL DEFAULT NULL AFTER \`id\``,
      );
    }

    // 2. branchId aus dem verknüpften Item übernehmen (wo noch NULL)
    await queryRunner.query(
      `UPDATE \`item_codes\` ic
       INNER JOIN \`items\` i ON ic.itemId = i.id
       SET ic.branchId = i.branchId
       WHERE ic.branchId IS NULL`,
    );

    // 3. NOT NULL setzen (idempotent – MODIFY ist sicher)
    await queryRunner.query(
      `ALTER TABLE \`item_codes\` MODIFY \`branchId\` char(36) NOT NULL`,
    );

    // 4. FK zu branches (falls noch nicht vorhanden)
    if (!(await this.fkExists(queryRunner, "item_codes", "FK_item_codes_branch"))) {
      await queryRunner.query(
        `ALTER TABLE \`item_codes\` ADD CONSTRAINT \`FK_item_codes_branch\`
         FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`) ON DELETE CASCADE`,
      );
    }

    // 5. Alten globalen Unique-Index auf code entfernen (falls vorhanden)
    const oldIdx = await this.findGlobalUniqueOnCode(queryRunner);
    if (oldIdx) {
      await queryRunner.query(`DROP INDEX \`${oldIdx}\` ON \`item_codes\``);
    }

    // 6. Neuen Composite-Index (branchId, code) anlegen (falls noch nicht vorhanden)
    if (!(await this.indexExists(queryRunner, "item_codes", "IDX_item_codes_branch_code"))) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX \`IDX_item_codes_branch_code\` ON \`item_codes\` (\`branchId\`, \`code\`)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.indexExists(queryRunner, "item_codes", "IDX_item_codes_branch_code")) {
      await queryRunner.query(`DROP INDEX \`IDX_item_codes_branch_code\` ON \`item_codes\``);
    }
    if (await this.fkExists(queryRunner, "item_codes", "FK_item_codes_branch")) {
      await queryRunner.query(`ALTER TABLE \`item_codes\` DROP FOREIGN KEY \`FK_item_codes_branch\``);
    }
    if (!(await this.indexExists(queryRunner, "item_codes", "IDX_item_codes_code"))) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX \`IDX_item_codes_code\` ON \`item_codes\` (\`code\`)`,
      );
    }
    if (await this.columnExists(queryRunner, "item_codes", "branchId")) {
      await queryRunner.query(`ALTER TABLE \`item_codes\` DROP COLUMN \`branchId\``);
    }
  }
}
