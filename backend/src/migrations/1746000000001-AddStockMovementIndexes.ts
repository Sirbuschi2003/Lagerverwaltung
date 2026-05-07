import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Indexes for stock_movements — the table with the highest write/read volume.
 * Without these every movement-history query is a full-table-scan.
 * Uses INFORMATION_SCHEMA guard so the migration is safely re-runnable.
 */
export class AddStockMovementIndexes1746000000001 implements MigrationInterface {
  name = "AddStockMovementIndexes1746000000001";

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
    // Per-item movement history sorted by date — most common access pattern
    await this.createIndexIfNotExists(
      queryRunner,
      "idx_sm_item_occurred",
      "stock_movements",
      "`itemId`, `occurredAt` DESC",
    );

    // Per-vehicle movement history sorted by date
    await this.createIndexIfNotExists(
      queryRunner,
      "idx_sm_vehicle_occurred",
      "stock_movements",
      "`vehicleId`, `occurredAt` DESC",
    );

    // Global date-range queries (branch-less super-admin dashboard)
    await this.createIndexIfNotExists(
      queryRunner,
      "idx_sm_occurred",
      "stock_movements",
      "`occurredAt` DESC",
    );

    // Source LIKE filter (Vorgangsnummer search)
    await this.createIndexIfNotExists(
      queryRunner,
      "idx_sm_source",
      "stock_movements",
      "`source`",
    );

    // Type enum filter (CHECKOUT / CHECKIN / ADJUSTMENT)
    await this.createIndexIfNotExists(
      queryRunner,
      "idx_sm_type",
      "stock_movements",
      "`type`",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexIfExists(queryRunner, "idx_sm_type",            "stock_movements");
    await this.dropIndexIfExists(queryRunner, "idx_sm_source",          "stock_movements");
    await this.dropIndexIfExists(queryRunner, "idx_sm_occurred",        "stock_movements");
    await this.dropIndexIfExists(queryRunner, "idx_sm_vehicle_occurred","stock_movements");
    await this.dropIndexIfExists(queryRunner, "idx_sm_item_occurred",   "stock_movements");
  }
}
