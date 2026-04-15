import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddRestockColumns1697196002000 implements MigrationInterface {
  name = 'AddRestockColumns1697196002000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if restock_requests table exists
    const restockTable = await queryRunner.getTable("restock_requests");
    if (restockTable) {
      
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
    }
  }
}