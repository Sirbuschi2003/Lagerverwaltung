import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Korrigiert vertauschte reorderPoint/minimumStock-Werte aus dem Hyreka-Import.
 *
 * Der Hyreka-Import hat bis einschließlich 15.06.2026 falsch gemappt:
 *   ALARMBES  → reorderPoint  (war aber der niedrigere Sicherheitspuffer)
 *   MINDESTBES → minimumStock  (war aber der eigentliche Bestellauslöser)
 *
 * Hyreka-Semantik (korrekt):
 *   MINDESTBES / Hyreka-Meldebestand  = Bestellauslöser  → reorderPoint
 *   ALARMBES   / Hyreka-Mindestbestand = Sicherheitspuffer → minimumStock
 *
 * Betroffen sind Artikel, bei denen reorderPoint < minimumStock gesetzt ist
 * — das ist das Merkmal des falschen Mappings, da ALARMBES immer ≤ MINDESTBES.
 */
export class SwapReorderPointMinimumStock1746600000001 implements MigrationInterface {
  name = "SwapReorderPointMinimumStock1746600000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tausche reorderPoint und minimumStock, wenn beide gesetzt und reorderPoint < minimumStock
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Tausch rückgängig: reorderPoint ist jetzt der hohe Wert, minimumStock der niedrige
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
  }
}
