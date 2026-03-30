import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Some databases still contain the legacy `actualQuantity` column alongside
 * the newer `countedQuantity`. Because `actualQuantity` is NOT NULL without a
 * default, inserts (e.g. during Backup-Restore) fail with
 * "Field 'actualQuantity' doesn't have a default value".
 *
 * This migration copies data from the legacy column (when present) into
 * `countedQuantity` if needed and then removes `actualQuantity` to align the
 * schema with the current entity.
 */
export class DropActualQuantityInventoryLines1732800000001 implements MigrationInterface {
  name = "DropActualQuantityInventoryLines1732800000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("inventory_lines");
    if (!table) return;

    const hasActual = table.findColumnByName("actualQuantity");
    const hasCounted = table.findColumnByName("countedQuantity");

    if (hasActual) {
      if (!hasCounted) {
        await queryRunner.addColumn(
          "inventory_lines",
          new TableColumn({
            name: "countedQuantity",
            type: "int",
            isNullable: false,
            default: 0,
          }),
        );
      }

      // Preserve data from the legacy column where the new column is empty.
      await queryRunner.query(`
        UPDATE \`inventory_lines\`
        SET countedQuantity = COALESCE(countedQuantity, actualQuantity, 0)
        WHERE countedQuantity IS NULL OR countedQuantity = 0
      `);

      await queryRunner.dropColumn("inventory_lines", "actualQuantity");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("inventory_lines");
    if (!table) return;

    const hasActual = table.findColumnByName("actualQuantity");
    if (!hasActual) {
      await queryRunner.addColumn(
        "inventory_lines",
        new TableColumn({
          name: "actualQuantity",
          type: "int",
          isNullable: false,
          default: 0,
        }),
      );
    }

    await queryRunner.query(`
      UPDATE \`inventory_lines\`
      SET actualQuantity = countedQuantity
      WHERE countedQuantity IS NOT NULL
    `);
  }
}
