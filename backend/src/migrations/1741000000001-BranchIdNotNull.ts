import { MigrationInterface, QueryRunner } from "typeorm";

export class BranchIdNotNull1741000000001 implements MigrationInterface {
  /** Hilfsfunktion: findet den Namen eines Unique-Index auf einer Spalte */
  private async findUniqueIndexName(queryRunner: QueryRunner, table: string, column: string): Promise<string | null> {
    const rows: Array<{ INDEX_NAME: string }> = await queryRunner.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
         AND NON_UNIQUE = 0
         AND INDEX_NAME != 'PRIMARY'
       LIMIT 1`,
      [table, column],
    );
    return rows.length > 0 ? rows[0].INDEX_NAME : null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = ["users", "vehicles", "items", "locations", "suppliers", "purchase_orders", "inventory_sessions"];

    // 1. FK droppen, branchId NOT NULL machen, FK neu anlegen
    for (const table of tables) {
      await queryRunner.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`FK_${table}_branch\``);
      await queryRunner.query(`ALTER TABLE \`${table}\` MODIFY \`branchId\` char(36) NOT NULL`);
      await queryRunner.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`FK_${table}_branch\` FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT`,
      );
    }

    // 2. items.code: globaler Unique → (branchId, code) per Branch
    const itemsCodeIdx = await this.findUniqueIndexName(queryRunner, "items", "code");
    if (itemsCodeIdx) {
      await queryRunner.query(`DROP INDEX \`${itemsCodeIdx}\` ON \`items\``);
    }
    await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_items_branch_code\` ON \`items\` (\`branchId\`, \`code\`)`);

    // 3. suppliers.name: globaler Unique → (branchId, name) per Branch
    const suppliersNameIdx = await this.findUniqueIndexName(queryRunner, "suppliers", "name");
    if (suppliersNameIdx) {
      await queryRunner.query(`DROP INDEX \`${suppliersNameIdx}\` ON \`suppliers\``);
    }
    await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_suppliers_branch_name\` ON \`suppliers\` (\`branchId\`, \`name\`)`);

    // 4. vehicles.licensePlate: globaler Unique → (branchId, licensePlate) per Branch
    const vehiclesLpIdx = await this.findUniqueIndexName(queryRunner, "vehicles", "licensePlate");
    if (vehiclesLpIdx) {
      await queryRunner.query(`DROP INDEX \`${vehiclesLpIdx}\` ON \`vehicles\``);
    }
    await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_vehicles_branch_licensePlate\` ON \`vehicles\` (\`branchId\`, \`licensePlate\`)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_vehicles_branch_licensePlate\` ON \`vehicles\``);
    await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_vehicles_licensePlate\` ON \`vehicles\` (\`licensePlate\`)`);

    await queryRunner.query(`DROP INDEX \`IDX_suppliers_branch_name\` ON \`suppliers\``);
    await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_suppliers_name\` ON \`suppliers\` (\`name\`)`);

    await queryRunner.query(`DROP INDEX \`IDX_items_branch_code\` ON \`items\``);
    await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_items_code\` ON \`items\` (\`code\`)`);

    const tables = ["users", "vehicles", "items", "locations", "suppliers", "purchase_orders", "inventory_sessions"];
    for (const table of tables) {
      await queryRunner.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`FK_${table}_branch\``);
      await queryRunner.query(`ALTER TABLE \`${table}\` MODIFY \`branchId\` char(36) NULL DEFAULT NULL`);
      await queryRunner.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`FK_${table}_branch\` FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT`,
      );
    }
  }
}
