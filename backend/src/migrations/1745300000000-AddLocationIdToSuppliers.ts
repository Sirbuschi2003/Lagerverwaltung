import { MigrationInterface, QueryRunner, TableForeignKey } from "typeorm";

export class AddLocationIdToSuppliers1745300000000 implements MigrationInterface {
  name = "AddLocationIdToSuppliers1745300000000";

  private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const result: Array<{ cnt: string }> = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column],
    );
    return Number(result[0]?.cnt ?? 0) > 0;
  }

  private async fkExists(queryRunner: QueryRunner, table: string, fkName: string): Promise<boolean> {
    const result: Array<{ cnt: string }> = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ? AND constraint_type = 'FOREIGN KEY'`,
      [table, fkName],
    );
    return Number(result[0]?.cnt ?? 0) > 0;
  }

  private async indexExists(queryRunner: QueryRunner, table: string, indexName: string): Promise<boolean> {
    const result: Array<{ cnt: string }> = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [table, indexName],
    );
    return Number(result[0]?.cnt ?? 0) > 0;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add locationId column (skip if already exists)
    if (!(await this.columnExists(queryRunner, "suppliers", "locationId"))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`locationId\` char(36) NULL`);
    }

    // Add FK to locations (skip if already exists)
    if (!(await this.fkExists(queryRunner, "suppliers", "FK_suppliers_location"))) {
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

    // Drop old unique index (branchId, name) if it exists
    if (await this.indexExists(queryRunner, "suppliers", "IDX_suppliers_branch_name")) {
      await queryRunner.query(`DROP INDEX \`IDX_suppliers_branch_name\` ON \`suppliers\``);
    }

    // New performance index (skip if already exists)
    if (!(await this.indexExists(queryRunner, "suppliers", "IDX_suppliers_branch_location"))) {
      await queryRunner.query(
        `CREATE INDEX \`IDX_suppliers_branch_location\` ON \`suppliers\` (\`branchId\`, \`locationId\`)`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.indexExists(queryRunner, "suppliers", "IDX_suppliers_branch_location")) {
      await queryRunner.query(`DROP INDEX \`IDX_suppliers_branch_location\` ON \`suppliers\``);
    }

    if (await this.fkExists(queryRunner, "suppliers", "FK_suppliers_location")) {
      const suppliersTable = await queryRunner.getTable("suppliers");
      const fk = suppliersTable?.foreignKeys.find((f) => f.name === "FK_suppliers_location");
      if (fk) await queryRunner.dropForeignKey("suppliers", fk);
    }

    if (await this.columnExists(queryRunner, "suppliers", "locationId")) {
      await queryRunner.dropColumn("suppliers", "locationId");
    }

    if (!(await this.indexExists(queryRunner, "suppliers", "IDX_suppliers_branch_name"))) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX \`IDX_suppliers_branch_name\` ON \`suppliers\` (\`branchId\`, \`name\`)`,
      );
    }
  }
}
