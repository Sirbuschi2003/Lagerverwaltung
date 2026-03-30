import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddInventoryLineColumns1729681300000 implements MigrationInterface {
  name = 'AddInventoryLineColumns1729681300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if inventory_lines table exists
    const inventoryLinesTable = await queryRunner.getTable('inventory_lines');
    
    if (inventoryLinesTable) {
      // Add countedQuantity column if it doesn't exist
      if (!inventoryLinesTable.findColumnByName('countedQuantity')) {
        await queryRunner.addColumn('inventory_lines', new TableColumn({
          name: 'countedQuantity',
          type: 'int',
          isNullable: false,
          default: 0,
        }));
      }

      // Add expectedQuantity column if it doesn't exist
      if (!inventoryLinesTable.findColumnByName('expectedQuantity')) {
        await queryRunner.addColumn('inventory_lines', new TableColumn({
          name: 'expectedQuantity',
          type: 'int',
          isNullable: false,
          default: 0,
        }));
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove added columns in reverse order
    const inventoryLinesTable = await queryRunner.getTable('inventory_lines');
    
    if (inventoryLinesTable) {
      if (inventoryLinesTable.findColumnByName('expectedQuantity')) {
        await queryRunner.dropColumn('inventory_lines', 'expectedQuantity');
      }
      
      if (inventoryLinesTable.findColumnByName('countedQuantity')) {
        await queryRunner.dropColumn('inventory_lines', 'countedQuantity');
      }
    }
  }
}