import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBranches1741000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Branches-Tabelle anlegen
    await queryRunner.query(`
      CREATE TABLE \`branches\` (
        \`id\` char(36) NOT NULL,
        \`externalCode\` varchar(20) NULL DEFAULT NULL,
        \`name\` varchar(100) NOT NULL,
        \`address\` text NULL DEFAULT NULL,
        \`active\` tinyint(1) NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    // Unique-Index nur auf nicht-null Werte (MySQL partial index via filtered approach)
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_branches_externalCode\` ON \`branches\` (\`externalCode\`)`
    );

    // 2. Standard-Niederlassung einfügen
    const defaultId = "00000000-0000-0000-0000-000000000001";
    await queryRunner.query(
      `INSERT INTO \`branches\` (\`id\`, \`externalCode\`, \`name\`, \`active\`) VALUES (?, NULL, 'Hauptniederlassung', 1)`,
      [defaultId]
    );

    // 3. branch_id-Spalte zu allen relevanten Tabellen hinzufügen (nullable)
    const tables = ["users", "vehicles", "items", "locations", "suppliers", "purchase_orders", "inventory_sessions"];
    for (const table of tables) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` ADD \`branchId\` char(36) NULL DEFAULT NULL`
      );
      await queryRunner.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`FK_${table}_branch\` FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT`
      );
    }

    // 4. Alle bestehenden Datensätze der Standard-Niederlassung zuordnen
    for (const table of tables) {
      await queryRunner.query(
        `UPDATE \`${table}\` SET \`branchId\` = ? WHERE \`branchId\` IS NULL`,
        [defaultId]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = ["users", "vehicles", "items", "locations", "suppliers", "purchase_orders", "inventory_sessions"];
    for (const table of tables) {
      await queryRunner.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`FK_${table}_branch\``);
      await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`branchId\``);
    }
    await queryRunner.query(`DROP INDEX \`IDX_branches_externalCode\` ON \`branches\``);
    await queryRunner.query(`DROP TABLE \`branches\``);
  }
}
