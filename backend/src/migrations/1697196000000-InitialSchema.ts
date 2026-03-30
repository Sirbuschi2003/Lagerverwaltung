import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class InitialSchema1697196000000 implements MigrationInterface {
  name = 'InitialSchema1697196000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.createTable(
      new Table({
        name: "users",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "username",
            type: "varchar",
            length: "120",
            isUnique: true,
          },
          {
            name: "displayName",
            type: "varchar",
            length: "120",
          },
          {
            name: "passwordHash",
            type: "varchar",
            length: "255",
          },
          {
            name: "email",
            type: "varchar",
            length: "120",
            isNullable: true,
          },
          {
            name: "role",
            type: "enum",
            enum: ["TECHNICIAN", "WAREHOUSE", "MANAGER"],
            default: "'TECHNICIAN'",
          },
          {
            name: "vehicleId",
            type: "char",
            length: "36",
            isNullable: true,
          },
          {
            name: "refreshInterval",
            type: "int",
            isNullable: true,
            default: 15,
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
      true
    );

    // Create vehicles table
    await queryRunner.createTable(
      new Table({
        name: "vehicles",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "licensePlate",
            type: "varchar",
            length: "20",
            isUnique: true,
          },
          {
            name: "description",
            type: "varchar",
            length: "255",
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
      true
    );

    // Create items table
    await queryRunner.createTable(
      new Table({
        name: "items",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "code",
            type: "varchar",
            length: "120",
            isUnique: true,
          },
          {
            name: "description",
            type: "varchar",
            length: "255",
          },
          {
            name: "manufacturer",
            type: "varchar",
            length: "120",
          },
          {
            name: "productGroup",
            type: "varchar",
            length: "120",
          },
          {
            name: "qrCodeValue",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "targetStock",
            type: "int",
            default: 0,
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
      true
    );

    // Create item_codes table
    await queryRunner.createTable(
      new Table({
        name: "item_codes",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "code",
            type: "varchar",
            length: "120",
          },
          {
            name: "type",
            type: "enum",
            enum: ["PRIMARY", "ALTERNATE", "BARCODE", "QR"],
            default: "'ALTERNATE'",
          },
          {
            name: "kind",
            type: "varchar",
            length: "32",
            default: "'ALIAS'",
          },
          {
            name: "itemId",
            type: "char",
            length: "36",
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Create stock_levels table
    await queryRunner.createTable(
      new Table({
        name: "stock_levels",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "itemId",
            type: "char",
            length: "36",
          },
          {
            name: "vehicleId",
            type: "char",
            length: "36",
          },
          {
            name: "quantity",
            type: "int",
            default: 0,
          },
          {
            name: "targetQuantity",
            type: "int",
            default: 0,
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
      true
    );

    // Create stock_movements table
    await queryRunner.createTable(
      new Table({
        name: "stock_movements",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "itemId",
            type: "char",
            length: "36",
          },
          {
            name: "vehicleId",
            type: "char",
            length: "36",
            isNullable: true,
          },
          {
            name: "userId",
            type: "char",
            length: "36",
            isNullable: true,
          },
          {
            name: "type",
            type: "enum",
            enum: ["CHECKOUT", "CHECKIN", "ADJUSTMENT"],
          },
          {
            name: "quantity",
            type: "int",
          },
          {
            name: "note",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "source",
            type: "varchar",
            length: "64",
          },
          {
            name: "occurredAt",
            type: "timestamp",
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Create inventory_sessions table
    await queryRunner.createTable(
      new Table({
        name: "inventory_sessions",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "name",
            type: "varchar",
            length: "255",
          },
          {
            name: "createdBy",
            type: "varchar",
            length: "120",
          },
          {
            name: "startedAt",
            type: "timestamp",
          },
          {
            name: "completedAt",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Create inventory_lines table
    await queryRunner.createTable(
      new Table({
        name: "inventory_lines",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "sessionId",
            type: "char",
            length: "36",
          },
          {
            name: "itemId",
            type: "char",
            length: "36",
          },
          {
            name: "vehicleId",
            type: "char",
            length: "36",
          },
          {
            name: "expectedQuantity",
            type: "int",
          },
          {
            name: "actualQuantity",
            type: "int",
          },
          {
            name: "note",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Create restock_requests table
    await queryRunner.createTable(
      new Table({
        name: "restock_requests",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "stockLevelId",
            type: "char",
            length: "36",
          },
          {
            name: "itemId",
            type: "char",
            length: "36",
          },
          {
            name: "vehicleId",
            type: "char",
            length: "36",
          },
          {
            name: "status",
            type: "enum",
            enum: ["PENDING", "APPROVED", "FULFILLED", "CANCELLED"],
            default: "'PENDING'",
          },
          {
            name: "quantityNeeded",
            type: "int",
          },
          {
            name: "quantityProvided",
            type: "int",
            isNullable: true,
          },
          {
            name: "note",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "readyAt",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "fulfilledAt",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "preparedById",
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
      true
    );

    // Add indexes / foreign keys (skip if they already exist)
    const extractRows = (raw: any): any[] => {
      if (Array.isArray(raw)) {
        if (raw.length > 0 && Array.isArray(raw[0])) return raw[0];
        return raw;
      }
      return [];
    };

    const ensureIndex = async (table: string, index: TableIndex) => {
      const existing = extractRows(await queryRunner.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
        [table, index.name],
      ));
      if (existing.length === 0) {
        await queryRunner.createIndex(table, index);
      }
    };

    await ensureIndex("users", new TableIndex({
      name: "IDX_users_username",
      columnNames: ["username"],
      isUnique: true
    }));
    
    await ensureIndex("vehicles", new TableIndex({
      name: "IDX_vehicles_licensePlate",
      columnNames: ["licensePlate"],
      isUnique: true
    }));
    
    await ensureIndex("items", new TableIndex({
      name: "IDX_items_code",
      columnNames: ["code"],
      isUnique: true
    }));
    
    await ensureIndex("stock_levels", new TableIndex({
      name: "IDX_stock_levels_unique",
      columnNames: ["itemId", "vehicleId"],
      isUnique: true
    }));

    const ensureForeignKey = async (table: string, fk: TableForeignKey) => {
      const fkName = fk.name ?? "";
      if (!fkName) {
        await queryRunner.createForeignKey(table, fk);
        return;
      }
      const existing = extractRows(await queryRunner.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ? LIMIT 1`,
        [fkName],
      ));
      if (existing.length === 0) {
        await queryRunner.createForeignKey(table, fk);
      }
    };

    // Add foreign keys
    await ensureForeignKey("users", new TableForeignKey({
      name: "FK_users_vehicle",
      columnNames: ["vehicleId"],
      referencedColumnNames: ["id"],
      referencedTableName: "vehicles",
      onDelete: "SET NULL"
    }));

    await ensureForeignKey("item_codes", new TableForeignKey({
      name: "FK_item_codes_item",
      columnNames: ["itemId"],
      referencedColumnNames: ["id"],
      referencedTableName: "items",
      onDelete: "CASCADE"
    }));

    await ensureForeignKey("stock_levels", new TableForeignKey({
      name: "FK_stock_levels_item",
      columnNames: ["itemId"],
      referencedColumnNames: ["id"],
      referencedTableName: "items",
      onDelete: "CASCADE"
    }));

    await ensureForeignKey("stock_levels", new TableForeignKey({
      name: "FK_stock_levels_vehicle",
      columnNames: ["vehicleId"],
      referencedColumnNames: ["id"],
      referencedTableName: "vehicles",
      onDelete: "CASCADE"
    }));

    await ensureForeignKey("stock_movements", new TableForeignKey({
      name: "FK_stock_movements_item",
      columnNames: ["itemId"],
      referencedColumnNames: ["id"],
      referencedTableName: "items",
      onDelete: "CASCADE"
    }));

    await ensureForeignKey("stock_movements", new TableForeignKey({
      name: "FK_stock_movements_vehicle",
      columnNames: ["vehicleId"],
      referencedColumnNames: ["id"],
      referencedTableName: "vehicles",
      onDelete: "SET NULL"
    }));

    await ensureForeignKey("stock_movements", new TableForeignKey({
      name: "FK_stock_movements_user",
      columnNames: ["userId"],
      referencedColumnNames: ["id"],
      referencedTableName: "users",
      onDelete: "SET NULL"
    }));

    await ensureForeignKey("inventory_lines", new TableForeignKey({
      name: "FK_inventory_lines_session",
      columnNames: ["sessionId"],
      referencedColumnNames: ["id"],
      referencedTableName: "inventory_sessions",
      onDelete: "CASCADE"
    }));

    await ensureForeignKey("inventory_lines", new TableForeignKey({
      name: "FK_inventory_lines_item",
      columnNames: ["itemId"],
      referencedColumnNames: ["id"],
      referencedTableName: "items",
      onDelete: "CASCADE"
    }));

    await ensureForeignKey("inventory_lines", new TableForeignKey({
      name: "FK_inventory_lines_vehicle",
      columnNames: ["vehicleId"],
      referencedColumnNames: ["id"],
      referencedTableName: "vehicles",
      onDelete: "CASCADE"
    }));

    await ensureForeignKey("restock_requests", new TableForeignKey({
      name: "FK_restock_requests_stocklevel",
      columnNames: ["stockLevelId"],
      referencedColumnNames: ["id"],
      referencedTableName: "stock_levels",
      onDelete: "CASCADE"
    }));

    await ensureForeignKey("restock_requests", new TableForeignKey({
      name: "FK_restock_requests_item",
      columnNames: ["itemId"],
      referencedColumnNames: ["id"],
      referencedTableName: "items",
      onDelete: "CASCADE"
    }));

    await ensureForeignKey("restock_requests", new TableForeignKey({
      name: "FK_restock_requests_vehicle",
      columnNames: ["vehicleId"],
      referencedColumnNames: ["id"],
      referencedTableName: "vehicles",
      onDelete: "CASCADE"
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const tables = ["restock_requests", "inventory_lines", "stock_movements", "stock_levels", "item_codes", "users"];
    
    for (const tableName of tables) {
      const table = await queryRunner.getTable(tableName);
      if (table) {
        const foreignKeys = table.foreignKeys;
        for (const foreignKey of foreignKeys) {
          await queryRunner.dropForeignKey(tableName, foreignKey);
        }
      }
    }

    // Drop indexes
    await queryRunner.dropIndex("stock_levels", "IDX_stock_levels_unique");
    await queryRunner.dropIndex("items", "IDX_items_code");
    await queryRunner.dropIndex("vehicles", "IDX_vehicles_licensePlate");
    await queryRunner.dropIndex("users", "IDX_users_username");

    // Drop tables in reverse order
    await queryRunner.dropTable("restock_requests");
    await queryRunner.dropTable("inventory_lines");
    await queryRunner.dropTable("inventory_sessions");
    await queryRunner.dropTable("stock_movements");
    await queryRunner.dropTable("stock_levels");
    await queryRunner.dropTable("item_codes");
    await queryRunner.dropTable("items");
    await queryRunner.dropTable("vehicles");
    await queryRunner.dropTable("users");
  }
}
