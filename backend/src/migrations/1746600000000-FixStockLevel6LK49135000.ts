import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Corrects the warehouse stock quantity for article 6LK49135000 (SEAL-SIDE-RER-H37X_F).
 * The DB contained quantity=11 but the Hyreka export of 2026-06-15 reported quantity=9.
 * The previous Hyreka import did not update this location-based stock_level entry.
 */
export class FixStockLevel6LK491350001746600000000 implements MigrationInterface {
  name = "FixStockLevel6LK491350001746600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE stock_levels sl
      INNER JOIN items i ON i.id = sl.itemId
      SET sl.quantity = 9, sl.updatedAt = NOW()
      WHERE i.code = '6LK49135000'
        AND sl.vehicleId IS NULL
        AND sl.locationId IS NOT NULL
        AND sl.quantity = 11
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE stock_levels sl
      INNER JOIN items i ON i.id = sl.itemId
      SET sl.quantity = 11, sl.updatedAt = NOW()
      WHERE i.code = '6LK49135000'
        AND sl.vehicleId IS NULL
        AND sl.locationId IS NOT NULL
        AND sl.quantity = 9
    `);
  }
}
