import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * D-01: The existing @Unique(["item","location"]) on stock_levels does not prevent
 * duplicate rows when locationId IS NULL, because MySQL treats each NULL as distinct
 * in a unique index. This causes duplicate (item, vehicle) stock levels.
 *
 * Fix: Add a functional unique index that substitutes NULL with a sentinel value,
 * ensuring true uniqueness for the (item, vehicle) pair on vehicle stock entries.
 * The existing (item, location) unique constraint covers warehouse stock correctly.
 */
export class FixStockLevelUniqueConstraint1746200000000 implements MigrationInterface {
  name = "FixStockLevelUniqueConstraint1746200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'stock_levels'
         AND INDEX_NAME = 'idx_sl_item_vehicle_unique'`,
    );
    if (Number(rows[0]?.cnt ?? 0) > 0) return;

    // Deduplicate first — repair any existing duplicates so the unique index can be created
    await queryRunner.query(`
      DELETE sl FROM stock_levels sl
      INNER JOIN (
        SELECT MIN(id) AS keep_id, itemId, COALESCE(vehicleId, '00000000-0000-0000-0000-000000000000') AS vkey
        FROM stock_levels
        GROUP BY itemId, vkey
        HAVING COUNT(*) > 1
      ) dups ON sl.itemId = dups.itemId
        AND COALESCE(sl.vehicleId, '00000000-0000-0000-0000-000000000000') = dups.vkey
        AND sl.id != dups.keep_id
    `);

    // Functional unique index: treats NULL vehicleId as a fixed sentinel so each
    // (item, vehicle) pair — including "no vehicle" — is truly unique.
    await queryRunner.query(`
      CREATE UNIQUE INDEX \`idx_sl_item_vehicle_unique\`
      ON \`stock_levels\` (
        (\`itemId\`),
        (COALESCE(\`vehicleId\`, '00000000-0000-0000-0000-000000000000'))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'stock_levels'
         AND INDEX_NAME = 'idx_sl_item_vehicle_unique'`,
    );
    if (Number(rows[0]?.cnt ?? 0) > 0) {
      await queryRunner.query(`DROP INDEX \`idx_sl_item_vehicle_unique\` ON \`stock_levels\``);
    }
  }
}
