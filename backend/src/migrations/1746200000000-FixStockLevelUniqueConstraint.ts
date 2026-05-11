import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * D-01: Clean up duplicate (item, vehicle) stock level rows.
 * MySQL's unique index on nullable columns allows multiple NULLs, so duplicates
 * can accumulate. The existing repair logic in StockService handles future
 * duplicates at application level. This migration removes any that already exist.
 *
 * Note: A functional unique index (COALESCE) was attempted but is not supported
 * on all MySQL/MariaDB versions in this environment.
 */
export class FixStockLevelUniqueConstraint1746200000000 implements MigrationInterface {
  name = "FixStockLevelUniqueConstraint1746200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove duplicate (item, vehicle) pairs — keep the row with the lowest id
    await queryRunner.query(`
      DELETE sl FROM stock_levels sl
      INNER JOIN (
        SELECT MIN(id) AS keep_id,
               itemId,
               COALESCE(vehicleId, '00000000-0000-0000-0000-000000000000') AS vkey
        FROM stock_levels
        GROUP BY itemId, vkey
        HAVING COUNT(*) > 1
      ) dups
        ON  sl.itemId = dups.itemId
        AND COALESCE(sl.vehicleId, '00000000-0000-0000-0000-000000000000') = dups.vkey
        AND sl.id != dups.keep_id
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Deduplication is not reversible
  }
}
