import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Missing performance indexes identified in audit:
 * - items.storageLocationId — join target in getRestockSuggestions / getRestockOverview
 * - stock_levels.(itemId, vehicleId) — lookup in normalizeVehicleStockLevels
 */
export class AddRemainingPerformanceIndexes1746100000000 implements MigrationInterface {
  name = "AddRemainingPerformanceIndexes1746100000000";

  private async createIndexIfNotExists(
    queryRunner: QueryRunner,
    indexName: string,
    tableName: string,
    columns: string,
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [tableName, indexName],
    );
    if (Number(rows[0]?.cnt ?? 0) === 0) {
      await queryRunner.query(
        `CREATE INDEX \`${indexName}\` ON \`${tableName}\` (${columns})`,
      );
    }
  }

  private async dropIndexIfExists(
    queryRunner: QueryRunner,
    indexName: string,
    tableName: string,
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [tableName, indexName],
    );
    if (Number(rows[0]?.cnt ?? 0) > 0) {
      await queryRunner.query(`DROP INDEX \`${indexName}\` ON \`${tableName}\``);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // items: FK index for storage location joins (B-05)
    await this.createIndexIfNotExists(
      queryRunner,
      "idx_items_storage_location",
      "items",
      "`storageLocationId`",
    );

    // stock_levels: composite for normalizeVehicleStockLevels lookups (B-04 / D-01)
    await this.createIndexIfNotExists(
      queryRunner,
      "idx_sl_item_vehicle",
      "stock_levels",
      "`itemId`, `vehicleId`",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexIfExists(queryRunner, "idx_sl_item_vehicle",          "stock_levels");
    await this.dropIndexIfExists(queryRunner, "idx_items_storage_location",   "items");
  }
}
