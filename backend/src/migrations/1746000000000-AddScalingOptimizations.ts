import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Remaining indexes for 200K+ articles / 200 concurrent users.
 * Uses INFORMATION_SCHEMA guard to be safely re-runnable.
 */
export class AddScalingOptimizations1746000000000 implements MigrationInterface {
  name = "AddScalingOptimizations1746000000000";

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
    // inventory_lines: session lookup (fehlt komplett)
    await this.createIndexIfNotExists(queryRunner, "idx_il_session",          "inventory_lines",   "`sessionId`");

    // purchase_orders: branch-aware status filter (war nur status solo)
    await this.createIndexIfNotExists(queryRunner, "idx_po_branch_status",    "purchase_orders",   "`branchId`, `status`");

    // system_logs: user lookup für Branch-Filter-Join
    await this.createIndexIfNotExists(queryRunner, "idx_sl_user_id",          "system_logs",       "`userId`");

    // items: branch-scoped manufacturer + productGroup filter (Fulltext deckt nur MATCH AGAINST)
    await this.createIndexIfNotExists(queryRunner, "idx_items_branch_mfr",    "items",             "`branchId`, `manufacturer`");
    await this.createIndexIfNotExists(queryRunner, "idx_items_branch_pg",     "items",             "`branchId`, `productGroup`");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexIfExists(queryRunner, "idx_items_branch_pg",     "items");
    await this.dropIndexIfExists(queryRunner, "idx_items_branch_mfr",    "items");
    await this.dropIndexIfExists(queryRunner, "idx_sl_user_id",          "system_logs");
    await this.dropIndexIfExists(queryRunner, "idx_po_branch_status",    "purchase_orders");
    await this.dropIndexIfExists(queryRunner, "idx_il_session",          "inventory_lines");
  }
}
