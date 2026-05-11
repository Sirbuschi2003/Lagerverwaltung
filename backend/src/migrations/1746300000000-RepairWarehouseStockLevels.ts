import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * D-02: Repair warehouse stock_levels deleted by migration 1746200000000.
 *
 * The previous migration grouped stock_levels by (itemId, vehicleId) WITHOUT locationId.
 * A warehouse item that had two entries — an old legacy entry (locationId=NULL, qty=0)
 * and a current shelf entry (locationId=SHELF_UUID, qty=N) — was treated as a duplicate.
 * MySQL MIN(id) kept the older entry (qty=0) and deleted the entry with actual stock.
 *
 * This migration restores correct quantities by recalculating from stock_movements.
 */
export class RepairWarehouseStockLevels1746300000000 implements MigrationInterface {
  name = "RepairWarehouseStockLevels1746300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO stock_levels (id, itemId, locationId, vehicleId, quantity, targetQuantity, createdAt, updatedAt)
      SELECT
        UUID()       AS id,
        m.itemId     AS itemId,
        m.locationId AS locationId,
        NULL         AS vehicleId,
        GREATEST(0, SUM(
          CASE m.type
            WHEN 'CHECKIN'    THEN  m.quantity
            WHEN 'ADJUSTMENT' THEN  m.quantity
            ELSE                   -m.quantity
          END
        )) AS quantity,
        0    AS targetQuantity,
        NOW() AS createdAt,
        NOW() AS updatedAt
      FROM stock_movements m
      WHERE m.vehicleId IS NULL AND m.locationId IS NOT NULL
      GROUP BY m.itemId, m.locationId
      ON DUPLICATE KEY UPDATE
        quantity  = GREATEST(0, VALUES(quantity)),
        updatedAt = NOW()
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Repair is not reversible
  }
}
