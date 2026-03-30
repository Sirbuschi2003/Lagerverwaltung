import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddMissingColumns1697196001000 implements MigrationInterface {
  name = 'AddMissingColumns1697196001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if kind column exists in item_codes table
    const itemCodesTable = await queryRunner.getTable("item_codes");
    if (itemCodesTable) {
      const kindColumn = itemCodesTable.findColumnByName("kind");
      if (!kindColumn) {
        await queryRunner.addColumn("item_codes", new TableColumn({
          name: "kind",
          type: "varchar",
          length: "32",
          default: "'ALIAS'",
        }));
      }
    }

    // Check if fulfilledAt column exists in restock_requests table
    const restockTable = await queryRunner.getTable("restock_requests");
    if (restockTable) {
      const fulfilledAtColumn = restockTable.findColumnByName("fulfilledAt");
      if (!fulfilledAtColumn) {
        await queryRunner.addColumn("restock_requests", new TableColumn({
          name: "fulfilledAt",
          type: "timestamp",
          isNullable: true,
        }));
      }

      // Check if readyAt column exists
      const readyAtColumn = restockTable.findColumnByName("readyAt");
      if (!readyAtColumn) {
        await queryRunner.addColumn("restock_requests", new TableColumn({
          name: "readyAt",
          type: "timestamp",
          isNullable: true,
        }));
      }

      // Check if preparedById column exists
      const preparedByIdColumn = restockTable.findColumnByName("preparedById");
      if (!preparedByIdColumn) {
        await queryRunner.addColumn("restock_requests", new TableColumn({
          name: "preparedById",
          type: "char",
          length: "36",
          isNullable: true,
        }));
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove kind column from item_codes if it exists
    const itemCodesTable = await queryRunner.getTable("item_codes");
    if (itemCodesTable) {
      const kindColumn = itemCodesTable.findColumnByName("kind");
      if (kindColumn) {
        await queryRunner.dropColumn("item_codes", "kind");
      }
    }

    // Remove columns from restock_requests if they exist
    const restockTable = await queryRunner.getTable("restock_requests");
    if (restockTable) {
      const preparedByIdColumn = restockTable.findColumnByName("preparedById");
      if (preparedByIdColumn) {
        await queryRunner.dropColumn("restock_requests", "preparedById");
      }

      const readyAtColumn = restockTable.findColumnByName("readyAt");
      if (readyAtColumn) {
        await queryRunner.dropColumn("restock_requests", "readyAt");
      }

      const fulfilledAtColumn = restockTable.findColumnByName("fulfilledAt");
      if (fulfilledAtColumn) {
        await queryRunner.dropColumn("restock_requests", "fulfilledAt");
      }
    }
  }
}