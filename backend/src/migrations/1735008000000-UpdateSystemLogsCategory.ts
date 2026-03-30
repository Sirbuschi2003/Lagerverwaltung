import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSystemLogsCategory1735008000000 implements MigrationInterface {
  name = 'UpdateSystemLogsCategory1735008000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = (
      await queryRunner.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_logs' LIMIT 1`,
      )
    ).length > 0;

    if (tableExists) {
      await queryRunner.query(`
        ALTER TABLE \`system_logs\` 
        MODIFY COLUMN \`category\` enum('AUTH', 'STOCK', 'VEHICLE', 'RESTOCK', 'USER', 'SYSTEM', 'INVENTORY') NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`system_logs\` 
      MODIFY COLUMN \`category\` enum('AUTH', 'STOCK', 'VEHICLE', 'RESTOCK', 'USER', 'SYSTEM') NOT NULL
    `);
  }
}
