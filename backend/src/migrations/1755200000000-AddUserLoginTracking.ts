import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserLoginTracking1755200000000 implements MigrationInterface {
  name = "AddUserLoginTracking1755200000000";

  private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return Number(rows[0]?.cnt ?? 0) > 0;
  }

  private async createIndexIfNotExists(
    queryRunner: QueryRunner,
    indexName: string,
    tableName: string,
    columns: string,
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [tableName, indexName],
    );
    if (Number(rows[0]?.cnt ?? 0) === 0) {
      await queryRunner.query(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` (${columns})`);
    }
  }

  private async dropIndexIfExists(queryRunner: QueryRunner, indexName: string, tableName: string): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [tableName, indexName],
    );
    if (Number(rows[0]?.cnt ?? 0) > 0) {
      await queryRunner.query(`DROP INDEX \`${indexName}\` ON \`${tableName}\``);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // SEC-003: DB-backed account lockout columns
    if (!(await this.columnExists(queryRunner, "users", "failedLoginAttempts"))) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`failedLoginAttempts\` int NOT NULL DEFAULT 0`,
      );
    }
    if (!(await this.columnExists(queryRunner, "users", "lockedUntil"))) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`lockedUntil\` datetime NULL DEFAULT NULL`,
      );
    }

    // P-03: index on restock_requests.status for frequent status-filter queries
    await this.createIndexIfNotExists(queryRunner, "idx_restock_requests_status", "restock_requests", "`status`");

    // P-04: index on inventory_sessions.finalizedAt for date-range queries
    await this.createIndexIfNotExists(queryRunner, "idx_inv_sessions_finalized_at", "inventory_sessions", "`finalizedAt`");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexIfExists(queryRunner, "idx_inv_sessions_finalized_at", "inventory_sessions");
    await this.dropIndexIfExists(queryRunner, "idx_restock_requests_status", "restock_requests");

    if (await this.columnExists(queryRunner, "users", "lockedUntil")) {
      await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`lockedUntil\``);
    }
    if (await this.columnExists(queryRunner, "users", "failedLoginAttempts")) {
      await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`failedLoginAttempts\``);
    }
  }
}
