import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveOrphanedStockLevels1746500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Remove stock_levels with no vehicle AND no location (true orphans).
    await queryRunner.query(`
      DELETE FROM stock_levels
      WHERE vehicleId IS NULL
        AND locationId IS NULL
    `);

    // 2. Remove stale stock_levels where the location no longer matches the item's
    //    current primary storageLocationId. These arise when an item is relocated but
    //    the old stock level record is not cleaned up, causing double-counting in reports.
    //    Only applies to non-vehicle entries (vehicleId IS NULL).
    await queryRunner.query(`
      DELETE sl FROM stock_levels sl
      INNER JOIN items i ON i.id = sl.itemId
      WHERE sl.vehicleId IS NULL
        AND sl.locationId IS NOT NULL
        AND sl.locationId != i.storageLocationId
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Stale records cannot be restored — down is intentionally a no-op.
  }
}
