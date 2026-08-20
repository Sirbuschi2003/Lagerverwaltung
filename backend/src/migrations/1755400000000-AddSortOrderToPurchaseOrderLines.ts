import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSortOrderToPurchaseOrderLines1755400000000 implements MigrationInterface {
  name = 'AddSortOrderToPurchaseOrderLines1755400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`purchase_order_lines\`
      ADD COLUMN \`sortOrder\` int NOT NULL DEFAULT 0
    `);
    // Initialize existing rows with a stable sort order based on insertion order
    await queryRunner.query(`
      UPDATE \`purchase_order_lines\` pol
      JOIN (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY orderId ORDER BY id) - 1 AS rn
        FROM \`purchase_order_lines\`
      ) ranked ON pol.id = ranked.id
      SET pol.sortOrder = ranked.rn
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`purchase_order_lines\`
      DROP COLUMN \`sortOrder\`
    `);
  }
}
