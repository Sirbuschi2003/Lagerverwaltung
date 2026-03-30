import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from "typeorm";

export class AddLocationsAndLinkStock1739000000000 implements MigrationInterface {
  name = "AddLocationsAndLinkStock1739000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "locations",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "type",
            type: "enum",
            enum: ["WAREHOUSE", "SHELF", "BIN", "VEHICLE"],
          },
          {
            name: "code",
            type: "varchar",
            length: "120",
          },
          {
            name: "name",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "parentId",
            type: "char",
            length: "36",
            isNullable: true,
          },
          {
            name: "vehicleId",
            type: "char",
            length: "36",
            isNullable: true,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updatedAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      "locations",
      new TableIndex({
        name: "IDX_locations_parent_code",
        columnNames: ["parentId", "code"],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      "locations",
      new TableIndex({
        name: "IDX_locations_vehicle",
        columnNames: ["vehicleId"],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      "locations",
      new TableForeignKey({
        name: "FK_locations_parent",
        columnNames: ["parentId"],
        referencedTableName: "locations",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      }),
    );

    await queryRunner.createForeignKey(
      "locations",
      new TableForeignKey({
        name: "FK_locations_vehicle",
        columnNames: ["vehicleId"],
        referencedTableName: "vehicles",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );

    await queryRunner.addColumn(
      "items",
      new TableColumn({
        name: "storageLocationId",
        type: "char",
        length: "36",
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      "stock_levels",
      new TableColumn({
        name: "locationId",
        type: "char",
        length: "36",
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      "stock_movements",
      new TableColumn({
        name: "locationId",
        type: "char",
        length: "36",
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      "inventory_lines",
      new TableColumn({
        name: "locationId",
        type: "char",
        length: "36",
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      "restock_requests",
      new TableColumn({
        name: "locationId",
        type: "char",
        length: "36",
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      "stock_levels",
      new TableIndex({
        name: "IDX_stock_levels_location",
        columnNames: ["locationId"],
      }),
    );

    await queryRunner.createIndex(
      "stock_movements",
      new TableIndex({
        name: "IDX_stock_movements_location",
        columnNames: ["locationId"],
      }),
    );

    await queryRunner.createIndex(
      "inventory_lines",
      new TableIndex({
        name: "IDX_inventory_lines_location",
        columnNames: ["locationId"],
      }),
    );

    await queryRunner.createIndex(
      "restock_requests",
      new TableIndex({
        name: "IDX_restock_requests_location",
        columnNames: ["locationId"],
      }),
    );

    await queryRunner.createForeignKey(
      "items",
      new TableForeignKey({
        name: "FK_items_storage_location",
        columnNames: ["storageLocationId"],
        referencedTableName: "locations",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      }),
    );

    await queryRunner.createForeignKey(
      "stock_levels",
      new TableForeignKey({
        name: "FK_stock_levels_location",
        columnNames: ["locationId"],
        referencedTableName: "locations",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      }),
    );

    await queryRunner.createForeignKey(
      "stock_movements",
      new TableForeignKey({
        name: "FK_stock_movements_location",
        columnNames: ["locationId"],
        referencedTableName: "locations",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      }),
    );

    await queryRunner.createForeignKey(
      "inventory_lines",
      new TableForeignKey({
        name: "FK_inventory_lines_location",
        columnNames: ["locationId"],
        referencedTableName: "locations",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      }),
    );

    await queryRunner.createForeignKey(
      "restock_requests",
      new TableForeignKey({
        name: "FK_restock_requests_location",
        columnNames: ["locationId"],
        referencedTableName: "locations",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      }),
    );

    await queryRunner.query(`
      INSERT INTO locations (id, type, code, name, createdAt, updatedAt)
      SELECT UUID(), 'WAREHOUSE', 'LAGER', 'Zentrallager', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM locations WHERE type = 'WAREHOUSE')
    `);

    await queryRunner.query(`
      INSERT INTO locations (id, type, code, name, vehicleId, createdAt, updatedAt)
      SELECT UUID(), 'VEHICLE', v.licensePlate, v.description, v.id, NOW(), NOW()
      FROM vehicles v
      WHERE NOT EXISTS (SELECT 1 FROM locations l WHERE l.vehicleId = v.id)
    `);

    await queryRunner.query(`
      UPDATE stock_levels sl
      JOIN locations l ON l.vehicleId = sl.vehicleId
      SET sl.locationId = l.id
      WHERE sl.locationId IS NULL
    `);

    await queryRunner.query(`
      UPDATE stock_movements sm
      JOIN locations l ON l.vehicleId = sm.vehicleId
      SET sm.locationId = l.id
      WHERE sm.vehicleId IS NOT NULL AND sm.locationId IS NULL
    `);

    await queryRunner.query(`
      UPDATE inventory_lines il
      JOIN locations l ON l.vehicleId = il.vehicleId
      SET il.locationId = l.id
      WHERE il.vehicleId IS NOT NULL AND il.locationId IS NULL
    `);

    await queryRunner.query(`
      UPDATE restock_requests rr
      JOIN locations l ON l.vehicleId = rr.vehicleId
      SET rr.locationId = l.id
      WHERE rr.locationId IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey("restock_requests", "FK_restock_requests_location");
    await queryRunner.dropForeignKey("inventory_lines", "FK_inventory_lines_location");
    await queryRunner.dropForeignKey("stock_movements", "FK_stock_movements_location");
    await queryRunner.dropForeignKey("stock_levels", "FK_stock_levels_location");
    await queryRunner.dropForeignKey("items", "FK_items_storage_location");

    await queryRunner.dropIndex("restock_requests", "IDX_restock_requests_location");
    await queryRunner.dropIndex("inventory_lines", "IDX_inventory_lines_location");
    await queryRunner.dropIndex("stock_movements", "IDX_stock_movements_location");
    await queryRunner.dropIndex("stock_levels", "IDX_stock_levels_location");

    await queryRunner.dropColumn("restock_requests", "locationId");
    await queryRunner.dropColumn("inventory_lines", "locationId");
    await queryRunner.dropColumn("stock_movements", "locationId");
    await queryRunner.dropColumn("stock_levels", "locationId");
    await queryRunner.dropColumn("items", "storageLocationId");

    await queryRunner.dropForeignKey("locations", "FK_locations_vehicle");
    await queryRunner.dropForeignKey("locations", "FK_locations_parent");
    await queryRunner.dropIndex("locations", "IDX_locations_vehicle");
    await queryRunner.dropIndex("locations", "IDX_locations_parent_code");
    await queryRunner.dropTable("locations");
  }
}
