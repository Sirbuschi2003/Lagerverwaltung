import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandSourceColumnStockMovements1735570000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE stock_movements 
      MODIFY COLUMN \`source\` VARCHAR(500) NOT NULL
      COMMENT 'Herkunft der Bewegung (z.B. Inventur mit Delta-Informationen)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE stock_movements 
      MODIFY COLUMN \`source\` VARCHAR(255) NOT NULL
    `);
  }
}
