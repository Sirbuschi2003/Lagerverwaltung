import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class RemovePurchaseOrderUnitPrice1739000004000 implements MigrationInterface {
  name = "RemovePurchaseOrderUnitPrice1739000004000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("purchase_order_lines");
    const hasUnitPrice = table?.columns.some((column) => column.name === "unitPrice");
    if (hasUnitPrice) {
      await queryRunner.dropColumn("purchase_order_lines", "unitPrice");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("purchase_order_lines");
    const hasUnitPrice = table?.columns.some((column) => column.name === "unitPrice");
    if (!hasUnitPrice) {
      await queryRunner.addColumn(
        "purchase_order_lines",
        new TableColumn({
          name: "unitPrice",
          type: "decimal",
          precision: 12,
          scale: 2,
          isNullable: true,
        }),
      );
    }
  }
}
