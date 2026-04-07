import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fügt branchId zur item_codes-Tabelle hinzu und ändert den Unique-Index
 * von global (code) auf per-Branch (branchId, code).
 * Damit können verschiedene Niederlassungen dieselben Alternativcodes verwenden.
 */
export class ItemCodesPerBranch1742000000001 implements MigrationInterface {
  private async findIndexName(queryRunner: QueryRunner, table: string, column: string, unique: boolean): Promise<string | null> {
    const rows: Array<{ INDEX_NAME: string }> = await queryRunner.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
         AND NON_UNIQUE = ?
         AND INDEX_NAME != 'PRIMARY'
       LIMIT 1`,
      [table, column, unique ? 0 : 1],
    );
    return rows.length > 0 ? rows[0].INDEX_NAME : null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. branchId-Spalte hinzufügen (nullable zunächst)
    await queryRunner.query(
      `ALTER TABLE \`item_codes\` ADD COLUMN \`branchId\` char(36) NULL DEFAULT NULL AFTER \`id\``,
    );

    // 2. branchId aus dem verknüpften Item übernehmen
    await queryRunner.query(
      `UPDATE \`item_codes\` ic
       INNER JOIN \`items\` i ON ic.itemId = i.id
       SET ic.branchId = i.branchId
       WHERE ic.branchId IS NULL`,
    );

    // 3. NOT NULL setzen
    await queryRunner.query(
      `ALTER TABLE \`item_codes\` MODIFY \`branchId\` char(36) NOT NULL`,
    );

    // 4. FK zu branches
    await queryRunner.query(
      `ALTER TABLE \`item_codes\` ADD CONSTRAINT \`FK_item_codes_branch\`
       FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`) ON DELETE CASCADE`,
    );

    // 5. Alten globalen Unique-Index auf code entfernen
    const oldIdx = await this.findIndexName(queryRunner, "item_codes", "code", true);
    if (oldIdx) {
      await queryRunner.query(`DROP INDEX \`${oldIdx}\` ON \`item_codes\``);
    }

    // 6. Neuen Composite-Index (branchId, code) anlegen
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_item_codes_branch_code\` ON \`item_codes\` (\`branchId\`, \`code\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Composite-Index entfernen
    await queryRunner.query(`DROP INDEX \`IDX_item_codes_branch_code\` ON \`item_codes\``);

    // FK entfernen
    await queryRunner.query(`ALTER TABLE \`item_codes\` DROP FOREIGN KEY \`FK_item_codes_branch\``);

    // Globalen Unique-Index wiederherstellen (nur wenn keine Duplikate existieren)
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_item_codes_code\` ON \`item_codes\` (\`code\`)`,
    );

    // branchId-Spalte entfernen
    await queryRunner.query(`ALTER TABLE \`item_codes\` DROP COLUMN \`branchId\``);
  }
}
