import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from "typeorm";

export class AddLocationIdToSuppliers1745300000000 implements MigrationInterface {
  name = "AddLocationIdToSuppliers1745300000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add locationId column
    await queryRunner.addColumn(
      "suppliers",
      new TableColumn({
        name: "locationId",
        type: "char",
        length: "36",
        isNullable: true,
        default: null,
      }),
    );

    // Add FK to locations
    await queryRunner.createForeignKey(
      "suppliers",
      new TableForeignKey({
        name: "FK_suppliers_location",
        columnNames: ["locationId"],
        referencedTableName: "locations",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      }),
    );

    // Drop old unique index (branchId, name) – same supplier name can now exist per location
    const suppliersTable = await queryRunner.getTable("suppliers");
    const oldIndex = suppliersTable?.indices.find(
      (idx) => idx.name === "IDX_suppliers_branch_name" || (idx.isUnique && idx.columnNames.includes("name") && idx.columnNames.includes("branchId")),
    );
    if (oldIndex?.name) {
      await queryRunner.dropIndex("suppliers", oldIndex.name);
    }

    // New index for fast lookups (not unique – MySQL treats NULLs as distinct in multi-col unique indexes
    // which would allow branch-level duplicates; a regular index is sufficient here)
    await queryRunner.query(
      `CREATE INDEX \`IDX_suppliers_branch_location\` ON \`suppliers\` (\`branchId\`, \`locationId\`)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_suppliers_branch_location\` ON \`suppliers\``);

    const suppliersTable = await queryRunner.getTable("suppliers");
    const fk = suppliersTable?.foreignKeys.find((f) => f.name === "FK_suppliers_location");
    if (fk) {
      await queryRunner.dropForeignKey("suppliers", fk);
    }

    await queryRunner.dropColumn("suppliers", "locationId");

    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_suppliers_branch_name\` ON \`suppliers\` (\`branchId\`, \`name\`)`,
    );
  }
}
