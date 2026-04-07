import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Entfernt globale Unique-Constraints auf items.qrCodeValue und items.code
 * die noch aus alten TypeORM-Migrationen stammen könnten, damit Artikel
 * mit gleichen Codes/QR-Codes in verschiedenen Niederlassungen existieren können.
 * Der korrekte per-Branch-Index IDX_items_branch_code wurde bereits in
 * Migration 1741000000001 angelegt.
 */
export class ItemsQrCodePerBranch1742000000003 implements MigrationInterface {
  private async dropUniqueIndexIfExists(queryRunner: QueryRunner, table: string, column: string): Promise<void> {
    const rows: Array<{ INDEX_NAME: string }> = await queryRunner.query(
      `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
         AND NON_UNIQUE = 0
         AND INDEX_NAME != 'PRIMARY'
         AND INDEX_NAME NOT IN ('IDX_items_branch_code')`,
      [table, column],
    );
    for (const row of rows) {
      await queryRunner.query(`DROP INDEX \`${row.INDEX_NAME}\` ON \`${table}\``);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Alte globale Unique-Indizes auf items.code und items.qrCodeValue entfernen
    await this.dropUniqueIndexIfExists(queryRunner, "items", "code");
    await this.dropUniqueIndexIfExists(queryRunner, "items", "qrCodeValue");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Nicht wiederherstellbar ohne Datenverlust – absichtlich leer
  }
}
