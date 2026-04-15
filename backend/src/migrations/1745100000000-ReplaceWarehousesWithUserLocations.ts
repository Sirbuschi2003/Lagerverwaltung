import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: Warehouses-Modul entfernen, user_locations Junction-Tabelle einführen
 *
 * - Entfernt warehouseId-Spalten von: users, items, purchase_orders, inventory_sessions
 * - Entfernt die warehouses-Tabelle
 * - Legt user_locations an (Many-to-Many: User ↔ Location[type=WAREHOUSE])
 */
export class ReplaceWarehousesWithUserLocations1745100000000 implements MigrationInterface {
  name = "ReplaceWarehousesWithUserLocations1745100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. FKs und warehouseId-Spalten entfernen
    await queryRunner.query(`ALTER TABLE \`inventory_sessions\` DROP FOREIGN KEY \`FK_inventory_sessions_warehouse\``);
    await queryRunner.query(`ALTER TABLE \`inventory_sessions\` DROP COLUMN \`warehouseId\``);

    await queryRunner.query(`ALTER TABLE \`purchase_orders\` DROP FOREIGN KEY \`FK_purchase_orders_warehouse\``);
    await queryRunner.query(`ALTER TABLE \`purchase_orders\` DROP COLUMN \`warehouseId\``);

    await queryRunner.query(`ALTER TABLE \`items\` DROP FOREIGN KEY \`FK_items_warehouse\``);
    await queryRunner.query(`ALTER TABLE \`items\` DROP COLUMN \`warehouseId\``);

    await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_users_warehouse\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`warehouseId\``);

    // 2. warehouses-Tabelle entfernen
    await queryRunner.query(`DROP TABLE IF EXISTS \`warehouses\``);

    // 3. user_locations Junction-Tabelle (User ↔ Location[type=WAREHOUSE])
    await queryRunner.query(`
      CREATE TABLE \`user_locations\` (
        \`userId\`     CHAR(36) NOT NULL,
        \`locationId\` CHAR(36) NOT NULL,
        PRIMARY KEY (\`userId\`, \`locationId\`),
        CONSTRAINT \`FK_user_locations_user\`
          FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`)
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_user_locations_location\`
          FOREIGN KEY (\`locationId\`) REFERENCES \`locations\` (\`id\`)
          ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // user_locations entfernen
    await queryRunner.query(`DROP TABLE IF EXISTS \`user_locations\``);

    // warehouses wiederherstellen
    await queryRunner.query(`
      CREATE TABLE \`warehouses\` (
        \`id\`          CHAR(36)     NOT NULL DEFAULT (UUID()),
        \`name\`        VARCHAR(120) NOT NULL,
        \`code\`        VARCHAR(20)  NULL,
        \`description\` TEXT         NULL,
        \`branchId\`    CHAR(36)     NULL,
        \`active\`      TINYINT(1)   NOT NULL DEFAULT 1,
        \`createdAt\`   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_warehouses_branch\`
          FOREIGN KEY (\`branchId\`) REFERENCES \`branches\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // warehouseId-Spalten zurück
    await queryRunner.query(`ALTER TABLE \`users\` ADD COLUMN \`warehouseId\` CHAR(36) NULL DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE \`items\` ADD COLUMN \`warehouseId\` CHAR(36) NULL DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE \`purchase_orders\` ADD COLUMN \`warehouseId\` CHAR(36) NULL DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE \`inventory_sessions\` ADD COLUMN \`warehouseId\` CHAR(36) NULL DEFAULT NULL`);
  }
}
