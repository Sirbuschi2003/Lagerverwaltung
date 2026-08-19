import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemLogsCategoryPurchaseEmail1755300000000 implements MigrationInterface {
  name = 'AddSystemLogsCategoryPurchaseEmail1755300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`system_logs\`
      MODIFY COLUMN \`category\` enum('AUTH', 'STOCK', 'VEHICLE', 'RESTOCK', 'USER', 'SYSTEM', 'INVENTORY', 'EMAIL', 'PURCHASE') NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`system_logs\`
      MODIFY COLUMN \`category\` enum('AUTH', 'STOCK', 'VEHICLE', 'RESTOCK', 'USER', 'SYSTEM', 'INVENTORY') NOT NULL
    `);
  }
}
