import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from "typeorm";

export class AddSuppliersAndPurchasing1739000001000 implements MigrationInterface {
  name = "AddSuppliersAndPurchasing1739000001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "suppliers",
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
            name: "addressLine1",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "addressLine2",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "postalCode",
            type: "varchar",
            length: "32",
            isNullable: true,
          },
          {
            name: "city",
            type: "varchar",
            length: "120",
            isNullable: true,
          },
          {
            name: "country",
            type: "varchar",
            length: "120",
            isNullable: true,
          },
          {
            name: "contactName",
            type: "varchar",
            length: "120",
            isNullable: true,
          },
          {
            name: "email",
            type: "varchar",
            length: "120",
            isNullable: true,
          },
          {
            name: "phone",
            type: "varchar",
            length: "60",
            isNullable: true,
          },
          {
            name: "notes",
            type: "varchar",
            length: "255",
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

    const suppliersTable = await queryRunner.getTable("suppliers");
    const hasSupplierNameIndex = suppliersTable?.indices.some(
      (idx) => idx.name === "IDX_suppliers_name"
        || (idx.isUnique && idx.columnNames.length === 1 && idx.columnNames[0] === "name"),
    );
    if (!hasSupplierNameIndex) {
      await queryRunner.createIndex(
        "suppliers",
        new TableIndex({
          name: "IDX_suppliers_name",
          columnNames: ["name"],
          isUnique: true,
        }),
      );
    }

    const itemsTableBefore = await queryRunner.getTable("items");
    const itemHasColumn = (name: string) => itemsTableBefore?.columns.some((col) => col.name === name);

    if (!itemHasColumn("supplierId")) {
      await queryRunner.addColumn(
        "items",
        new TableColumn({
          name: "supplierId",
          type: "char",
          length: "36",
          isNullable: true,
        }),
      );
    }

    if (!itemHasColumn("price")) {
      await queryRunner.addColumn(
        "items",
        new TableColumn({
          name: "price",
          type: "decimal",
          precision: 12,
          scale: 2,
          isNullable: true,
        }),
      );
    }

    if (!itemHasColumn("packSize")) {
      await queryRunner.addColumn(
        "items",
        new TableColumn({
          name: "packSize",
          type: "int",
          isNullable: true,
        }),
      );
    }

    if (!itemHasColumn("orderQuantity")) {
      await queryRunner.addColumn(
        "items",
        new TableColumn({
          name: "orderQuantity",
          type: "int",
          isNullable: true,
        }),
      );
    }

    const itemsTable = await queryRunner.getTable("items");
    const hasItemsSupplierIndex = itemsTable?.indices.some(
      (idx) => idx.name === "IDX_items_supplier"
        || (idx.columnNames.length === 1 && idx.columnNames[0] === "supplierId"),
    );
    if (!hasItemsSupplierIndex) {
      await queryRunner.createIndex(
        "items",
        new TableIndex({
          name: "IDX_items_supplier",
          columnNames: ["supplierId"],
        }),
      );
    }

    const hasItemsSupplierFk = itemsTable?.foreignKeys.some(
      (fk) => fk.name === "FK_items_supplier"
        || (fk.columnNames.length === 1 && fk.columnNames[0] === "supplierId"),
    );
    if (!hasItemsSupplierFk) {
      await queryRunner.createForeignKey(
        "items",
        new TableForeignKey({
          name: "FK_items_supplier",
          columnNames: ["supplierId"],
          referencedTableName: "suppliers",
          referencedColumnNames: ["id"],
          onDelete: "SET NULL",
        }),
      );
    }

    await queryRunner.createTable(
      new Table({
        name: "purchase_orders",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "supplierId",
            type: "char",
            length: "36",
          },
          {
            name: "status",
            type: "enum",
            enum: ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"],
            default: "'DRAFT'",
          },
          {
            name: "orderNumber",
            type: "varchar",
            length: "64",
            isNullable: true,
          },
          {
            name: "orderedAt",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "receivedAt",
            type: "timestamp",
            isNullable: true,
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
          {
            name: "updatedAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "purchase_order_lines",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
            generationStrategy: "uuid",
          },
          {
            name: "orderId",
            type: "char",
            length: "36",
          },
          {
            name: "itemId",
            type: "char",
            length: "36",
          },
          {
            name: "quantity",
            type: "int",
          },
          {
            name: "receivedQuantity",
            type: "int",
            default: 0,
          },
          {
            name: "packSize",
            type: "int",
            isNullable: true,
          },
        ],
      }),
      true,
    );

    const purchaseOrdersTable = await queryRunner.getTable("purchase_orders");
    const purchaseOrderLinesTable = await queryRunner.getTable("purchase_order_lines");

    const hasPurchaseOrdersSupplierIndex = purchaseOrdersTable?.indices.some(
      (idx) => idx.name === "IDX_purchase_orders_supplier"
        || (idx.columnNames.length === 1 && idx.columnNames[0] === "supplierId"),
    );
    if (!hasPurchaseOrdersSupplierIndex) {
      await queryRunner.createIndex(
        "purchase_orders",
        new TableIndex({
          name: "IDX_purchase_orders_supplier",
          columnNames: ["supplierId"],
        }),
      );
    }

    const hasPurchaseOrderLinesOrderIndex = purchaseOrderLinesTable?.indices.some(
      (idx) => idx.name === "IDX_purchase_order_lines_order"
        || (idx.columnNames.length === 1 && idx.columnNames[0] === "orderId"),
    );
    if (!hasPurchaseOrderLinesOrderIndex) {
      await queryRunner.createIndex(
        "purchase_order_lines",
        new TableIndex({
          name: "IDX_purchase_order_lines_order",
          columnNames: ["orderId"],
        }),
      );
    }

    const hasPurchaseOrdersSupplierFk = purchaseOrdersTable?.foreignKeys.some(
      (fk) => fk.name === "FK_purchase_orders_supplier"
        || (fk.columnNames.length === 1 && fk.columnNames[0] === "supplierId"),
    );
    if (!hasPurchaseOrdersSupplierFk) {
      await queryRunner.createForeignKey(
        "purchase_orders",
        new TableForeignKey({
          name: "FK_purchase_orders_supplier",
          columnNames: ["supplierId"],
          referencedTableName: "suppliers",
          referencedColumnNames: ["id"],
          onDelete: "RESTRICT",
        }),
      );
    }

    const hasPurchaseOrderLinesOrderFk = purchaseOrderLinesTable?.foreignKeys.some(
      (fk) => fk.name === "FK_purchase_order_lines_order"
        || (fk.columnNames.length === 1 && fk.columnNames[0] === "orderId"),
    );
    if (!hasPurchaseOrderLinesOrderFk) {
      await queryRunner.createForeignKey(
        "purchase_order_lines",
        new TableForeignKey({
          name: "FK_purchase_order_lines_order",
          columnNames: ["orderId"],
          referencedTableName: "purchase_orders",
          referencedColumnNames: ["id"],
          onDelete: "CASCADE",
        }),
      );
    }

    const hasPurchaseOrderLinesItemFk = purchaseOrderLinesTable?.foreignKeys.some(
      (fk) => fk.name === "FK_purchase_order_lines_item"
        || (fk.columnNames.length === 1 && fk.columnNames[0] === "itemId"),
    );
    if (!hasPurchaseOrderLinesItemFk) {
      await queryRunner.createForeignKey(
        "purchase_order_lines",
        new TableForeignKey({
          name: "FK_purchase_order_lines_item",
          columnNames: ["itemId"],
          referencedTableName: "items",
          referencedColumnNames: ["id"],
          onDelete: "RESTRICT",
        }),
      );
    }

    const stockLevels = await queryRunner.getTable("stock_levels");
    if (stockLevels) {
      const uniqueIndex = stockLevels.indices.find(
        (idx) => idx.name === "IDX_stock_levels_unique" || (idx.isUnique && idx.columnNames.includes("vehicleId")),
      );
      if (uniqueIndex) {
        try {
          await queryRunner.dropIndex("stock_levels", uniqueIndex);
        } catch (error) {
          // Index kann durch FK constraints benoetigt werden; in dem Fall belassen.
        }
      }

      const vehicleColumn = stockLevels.columns.find((col) => col.name === "vehicleId");
      if (vehicleColumn && !vehicleColumn.isNullable) {
        await queryRunner.changeColumn(
          "stock_levels",
          "vehicleId",
          new TableColumn({ ...vehicleColumn, isNullable: true }),
        );
      }
    }

    await queryRunner.query(`
      UPDATE stock_levels sl
      JOIN locations l ON l.vehicleId = sl.vehicleId
      SET sl.locationId = l.id
      WHERE sl.vehicleId IS NOT NULL AND sl.locationId IS NULL
    `);

    const stockLevelsTableAfter = await queryRunner.getTable("stock_levels");
    const hasItemLocationIndex = stockLevelsTableAfter?.indices.some(
      (idx) => idx.name === "IDX_stock_levels_item_location"
        || (idx.isUnique && idx.columnNames.includes("itemId") && idx.columnNames.includes("locationId")),
    );
    if (!hasItemLocationIndex) {
      await queryRunner.createIndex(
        "stock_levels",
        new TableIndex({
          name: "IDX_stock_levels_item_location",
          columnNames: ["itemId", "locationId"],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex("stock_levels", "IDX_stock_levels_item_location");

    const stockLevels = await queryRunner.getTable("stock_levels");
    if (stockLevels) {
      const vehicleColumn = stockLevels.columns.find((col) => col.name === "vehicleId");
      if (vehicleColumn && vehicleColumn.isNullable) {
        await queryRunner.changeColumn(
          "stock_levels",
          "vehicleId",
          new TableColumn({ ...vehicleColumn, isNullable: false }),
        );
      }
    }

    await queryRunner.dropForeignKey("purchase_order_lines", "FK_purchase_order_lines_item");
    await queryRunner.dropForeignKey("purchase_order_lines", "FK_purchase_order_lines_order");
    await queryRunner.dropForeignKey("purchase_orders", "FK_purchase_orders_supplier");

    await queryRunner.dropIndex("purchase_order_lines", "IDX_purchase_order_lines_order");
    await queryRunner.dropIndex("purchase_orders", "IDX_purchase_orders_supplier");
    await queryRunner.dropTable("purchase_order_lines");
    await queryRunner.dropTable("purchase_orders");

    await queryRunner.dropForeignKey("items", "FK_items_supplier");
    await queryRunner.dropIndex("items", "IDX_items_supplier");
    await queryRunner.dropColumn("items", "orderQuantity");
    await queryRunner.dropColumn("items", "packSize");
    await queryRunner.dropColumn("items", "price");
    await queryRunner.dropColumn("items", "supplierId");

    await queryRunner.dropIndex("suppliers", "IDX_suppliers_name");
    await queryRunner.dropTable("suppliers");
  }
}
