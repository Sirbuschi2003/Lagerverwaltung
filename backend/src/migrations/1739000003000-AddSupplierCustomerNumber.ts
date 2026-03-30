import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddSupplierCustomerNumber1739000003000 implements MigrationInterface {
  name = "AddSupplierCustomerNumber1739000003000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("suppliers");
    const hasColumn = table?.columns.some((col) => col.name === "customerNumber");
    if (!hasColumn) {
      await queryRunner.addColumn(
        "suppliers",
        new TableColumn({
          name: "customerNumber",
          type: "varchar",
          length: "120",
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("suppliers");
    const hasColumn = table?.columns.some((col) => col.name === "customerNumber");
    if (hasColumn) {
      await queryRunner.dropColumn("suppliers", "customerNumber");
    }
  }
}
