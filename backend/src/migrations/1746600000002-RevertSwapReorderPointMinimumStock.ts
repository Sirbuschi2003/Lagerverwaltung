import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Reverts migration 1746600000001-SwapReorderPointMinimumStock.
 *
 * The swap affected ALL articles where reorderPoint < minimumStock,
 * including toner articles whose values were already correct.
 * This migration restores the original state.
 *
 * Teilelager articles will be corrected by the next Hyreka CSV import,
 * which now correctly maps MINDESTBES → reorderPoint.
 */
export class RevertSwapReorderPointMinimumStock1746600000002 implements MigrationInterface {
  name = "RevertSwapReorderPointMinimumStock1746600000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Undo: swap back articles where reorderPoint > minimumStock (result of the previous swap)
    await queryRunner.query(`
      UPDATE items
      SET
        reorderPoint = minimumStock,
        minimumStock = reorderPoint,
        updatedAt    = NOW()
      WHERE reorderPoint IS NOT NULL
        AND minimumStock IS NOT NULL
        AND reorderPoint > minimumStock
    `);

    // Also restore targetStock for articles that were incorrectly raised
    // (targetStock was set to old minimumStock if it was below — revert to reorderPoint)
    await queryRunner.query(`
      UPDATE items
      SET
        targetStock = reorderPoint,
        updatedAt   = NOW()
      WHERE reorderPoint IS NOT NULL
        AND targetStock IS NOT NULL
        AND targetStock = minimumStock
        AND reorderPoint < minimumStock
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-apply the original swap (same logic as 1746600000001 up)
    await queryRunner.query(`
      UPDATE items
      SET
        reorderPoint  = minimumStock,
        minimumStock  = reorderPoint,
        targetStock   = CASE
                          WHEN targetStock IS NULL OR targetStock = 0 OR targetStock < minimumStock
                          THEN minimumStock
                          ELSE targetStock
                        END,
        updatedAt = NOW()
      WHERE reorderPoint IS NOT NULL
        AND minimumStock IS NOT NULL
        AND reorderPoint < minimumStock
    `);
  }
}
