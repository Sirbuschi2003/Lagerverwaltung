import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMissingColumns1729681200000 implements MigrationInterface {
  name = 'AddMissingColumns1729681200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add missing columns to restock_requests table if they don't exist
    const restockTable = await queryRunner.getTable('restock_requests');
    
    if (restockTable && !restockTable.findColumnByName('fulfilledAt')) {
      await queryRunner.addColumn('restock_requests', new TableColumn({
        name: 'fulfilledAt',
        type: 'datetime',
        isNullable: true,
        default: null,
      }));
    }

    if (restockTable && !restockTable.findColumnByName('kind')) {
      await queryRunner.addColumn('restock_requests', new TableColumn({
        name: 'kind',
        type: 'varchar',
        length: '20',
        default: "'SHORTAGE'",
      }));
    }

    if (restockTable && !restockTable.findColumnByName('readyAt')) {
      await queryRunner.addColumn('restock_requests', new TableColumn({
        name: 'readyAt',
        type: 'datetime',
        isNullable: true,
        default: null,
      }));
    }

    if (restockTable && !restockTable.findColumnByName('preparedById')) {
      await queryRunner.addColumn('restock_requests', new TableColumn({
        name: 'preparedById',
        type: 'int',
        isNullable: true,
        default: null,
      }));
    }

    // Add missing columns to inventory_sessions table if they don't exist
    const inventoryTable = await queryRunner.getTable('inventory_sessions');
    
    if (inventoryTable && !inventoryTable.findColumnByName('completedAt')) {
      await queryRunner.addColumn('inventory_sessions', new TableColumn({
        name: 'completedAt',
        type: 'datetime',
        isNullable: true,
        default: null,
      }));
    }

    if (inventoryTable && !inventoryTable.findColumnByName('status')) {
      await queryRunner.addColumn('inventory_sessions', new TableColumn({
        name: 'status',
        type: 'varchar',
        length: '20',
        default: "'ACTIVE'",
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove added columns in reverse order
    const restockTable = await queryRunner.getTable('restock_requests');
    if (restockTable) {
      if (restockTable.findColumnByName('preparedById')) {
        await queryRunner.dropColumn('restock_requests', 'preparedById');
      }
      if (restockTable.findColumnByName('readyAt')) {
        await queryRunner.dropColumn('restock_requests', 'readyAt');
      }
      if (restockTable.findColumnByName('kind')) {
        await queryRunner.dropColumn('restock_requests', 'kind');
      }
      if (restockTable.findColumnByName('fulfilledAt')) {
        await queryRunner.dropColumn('restock_requests', 'fulfilledAt');
      }
    }

    const inventoryTable = await queryRunner.getTable('inventory_sessions');
    if (inventoryTable) {
      if (inventoryTable.findColumnByName('status')) {
        await queryRunner.dropColumn('inventory_sessions', 'status');
      }
      if (inventoryTable.findColumnByName('completedAt')) {
        await queryRunner.dropColumn('inventory_sessions', 'completedAt');
      }
    }
  }
}