import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveOrphanedStockLevels1746500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove stock_levels with neither a vehicle nor a location — these are orphaned records
    // that can accumulate due to MySQL allowing multiple (itemId, NULL) entries in UNIQUE constraints.
    // They are invisible on the items page but inflate stock totals in reports.
    await queryRunner.query(`
      DELETE FROM stock_levels
      WHERE vehicleId IS NULL
        AND locationId IS NULL
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Orphaned records cannot be restored — down is intentionally a no-op.
  }
}
