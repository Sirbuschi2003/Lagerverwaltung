import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: Mehrere Lager (Warehouses) pro Niederlassung
 *
 * - Neue Tabelle `warehouses` (branchId FK zu branches)
 * - Neues Feld `warehouseId` auf: users, items, purchase_orders, inventory_sessions
 * - Bestehende Daten bleiben unverändert (warehouseId bleibt nullable)
 */
export class AddWarehouses1745000000000 implements MigrationInterface {
  name = "AddWarehouses1745000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. warehouses-Tabelle anlegen
    await queryRunner.query(`
      CREATE TABLE \`warehouses\` (
        \`id\`          CHAR(36)        NOT NULL DEFAULT (UUID()),
        \`name\`        VARCHAR(120)    NOT NULL,
        \`code\`        VARCHAR(20)     NULL DEFAULT NULL,
        \`description\` TEXT            NULL DEFAULT NULL,
        \`branchId\`    CHAR(36)        NULL DEFAULT NULL,
        \`active\`      TINYINT(1)      NOT NULL DEFAULT 1,
        \`createdAt\`   DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`   DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_warehouses_branch\`
          FOREIGN KEY (\`branchId\`) REFERENCES \`branches\` (\`id\`)
          ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. warehouseId auf users
    await queryRunner.query(`
      ALTER TABLE \`users\`
        ADD COLUMN \`warehouseId\` CHAR(36) NULL DEFAULT NULL AFTER \`branchId\`,
        ADD CONSTRAINT \`FK_users_warehouse\`
          FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouses\` (\`id\`)
          ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // 3. warehouseId auf items
    await queryRunner.query(`
      ALTER TABLE \`items\`
        ADD COLUMN \`warehouseId\` CHAR(36) NULL DEFAULT NULL AFTER \`branchId\`,
        ADD CONSTRAINT \`FK_items_warehouse\`
          FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouses\` (\`id\`)
          ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // 4. warehouseId auf purchase_orders
    await queryRunner.query(`
      ALTER TABLE \`purchase_orders\`
        ADD COLUMN \`warehouseId\` CHAR(36) NULL DEFAULT NULL AFTER \`branchId\`,
        ADD CONSTRAINT \`FK_purchase_orders_warehouse\`
          FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouses\` (\`id\`)
          ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // 5. warehouseId auf inventory_sessions
    await queryRunner.query(`
      ALTER TABLE \`inventory_sessions\`
        ADD COLUMN \`warehouseId\` CHAR(36) NULL DEFAULT NULL AFTER \`branchId\`,
        ADD CONSTRAINT \`FK_inventory_sessions_warehouse\`
          FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouses\` (\`id\`)
          ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // inventory_sessions
    await queryRunner.query(`ALTER TABLE \`inventory_sessions\` DROP FOREIGN KEY \`FK_inventory_sessions_warehouse\``);
    await queryRunner.query(`ALTER TABLE \`inventory_sessions\` DROP COLUMN \`warehouseId\``);

    // purchase_orders
    await queryRunner.query(`ALTER TABLE \`purchase_orders\` DROP FOREIGN KEY \`FK_purchase_orders_warehouse\``);
    await queryRunner.query(`ALTER TABLE \`purchase_orders\` DROP COLUMN \`warehouseId\``);

    // items
    await queryRunner.query(`ALTER TABLE \`items\` DROP FOREIGN KEY \`FK_items_warehouse\``);
    await queryRunner.query(`ALTER TABLE \`items\` DROP COLUMN \`warehouseId\``);

    // users
    await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_users_warehouse\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`warehouseId\``);

    // warehouses-Tabelle
    await queryRunner.query(`DROP TABLE \`warehouses\``);
  }
}
