import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Composite indexes for the most frequent query patterns.
 * Prevents full-table-scans on stock_movements and items under multi-branch load.
 * Uses IF NOT EXISTS pattern via INFORMATION_SCHEMA to be idempotent.
 */
export class AddQueryPerformanceIndexes1745400000000 implements MigrationInterface {
  name = "AddQueryPerformanceIndexes1745400000000";

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
    await this.createIndexIfNotExists(queryRunner, "idx_sm_item_occurred",   "stock_movements", "`itemId`, `occurredAt`");
    await this.createIndexIfNotExists(queryRunner, "idx_sm_vehicle_occurred","stock_movements", "`vehicleId`, `occurredAt`");
    await this.createIndexIfNotExists(queryRunner, "idx_sm_type",            "stock_movements", "`type`");
    await this.createIndexIfNotExists(queryRunner, "idx_sm_is_voided",       "stock_movements", "`isVoided`");
    await this.createIndexIfNotExists(queryRunner, "idx_items_branch_target","items",           "`branchId`, `targetStock`");
    await this.createIndexIfNotExists(queryRunner, "idx_sl_vehicle",         "stock_levels",    "`vehicleId`");
    await this.createIndexIfNotExists(queryRunner, "idx_sl_location",        "stock_levels",    "`locationId`");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexIfExists(queryRunner, "idx_sl_location",         "stock_levels");
    await this.dropIndexIfExists(queryRunner, "idx_sl_vehicle",          "stock_levels");
    await this.dropIndexIfExists(queryRunner, "idx_items_branch_target", "items");
    await this.dropIndexIfExists(queryRunner, "idx_sm_is_voided",        "stock_movements");
    await this.dropIndexIfExists(queryRunner, "idx_sm_type",             "stock_movements");
    await this.dropIndexIfExists(queryRunner, "idx_sm_vehicle_occurred", "stock_movements");
    await this.dropIndexIfExists(queryRunner, "idx_sm_item_occurred",    "stock_movements");
  }
}
