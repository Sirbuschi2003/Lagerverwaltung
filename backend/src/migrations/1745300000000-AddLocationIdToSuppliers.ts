import { MigrationInterface, QueryRunner, TableForeignKey } from "typeorm";

export class AddLocationIdToSuppliers1745300000000 implements MigrationInterface {
  name = "AddLocationIdToSuppliers1745300000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add locationId column (skip if already exists from a partial previous run)
    const suppliersTableBefore = await queryRunner.getTable("suppliers");
    const hasColumn = suppliersTableBefore?.columns.some((c) => c.name === "locationId");
    if (!hasColumn) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`locationId\` char(36) NULL`);
    }

    // Add FK to locations (skip if already exists)
    const suppliersTableAfterCol = await queryRunner.getTable("suppliers");
    const hasFk = suppliersTableAfterCol?.foreignKeys.some((f) => f.name === "FK_suppliers_location");
    if (!hasFk) {
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
    }

    // Drop old unique index (branchId, name) – same supplier name can now exist per location
    const suppliersTable = await queryRunner.getTable("suppliers");
    const oldIndex = suppliersTable?.indices.find(
      (idx) => idx.name === "IDX_suppliers_branch_name" || (idx.isUnique && idx.columnNames.includes("name") && idx.columnNames.includes("branchId")),
    );
    if (oldIndex?.name) {
      await queryRunner.dropIndex("suppliers", oldIndex.name);
    }

    // New index for fast lookups (not unique)
    const hasNewIndex = suppliersTable?.indices.some((idx) => idx.name === "IDX_suppliers_branch_location");
    if (!hasNewIndex) {
      await queryRunner.query(
        `CREATE INDEX \`IDX_suppliers_branch_location\` ON \`suppliers\` (\`branchId\`, \`locationId\`)`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const suppliersTable = await queryRunner.getTable("suppliers");

    const hasNewIndex = suppliersTable?.indices.some((idx) => idx.name === "IDX_suppliers_branch_location");
    if (hasNewIndex) {
      await queryRunner.query(`DROP INDEX \`IDX_suppliers_branch_location\` ON \`suppliers\``);
    }

    const fk = suppliersTable?.foreignKeys.find((f) => f.name === "FK_suppliers_location");
    if (fk) {
      await queryRunner.dropForeignKey("suppliers", fk);
    }

    const hasColumn = suppliersTable?.columns.some((c) => c.name === "locationId");
    if (hasColumn) {
      await queryRunner.dropColumn("suppliers", "locationId");
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_suppliers_branch_name\` ON \`suppliers\` (\`branchId\`, \`name\`)`,
    );
  }
}
