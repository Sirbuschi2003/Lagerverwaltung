import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityHardeningFixes1755600000000 implements MigrationInterface {
  name = 'SecurityHardeningFixes1755600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clean up expired and used password reset tokens (DSGVO data minimisation)
    // Column names are camelCase as TypeORM created them (expiresAt, createdAt)
    await queryRunner.query(`
      DELETE FROM password_reset_tokens
      WHERE used = 1
         OR expiresAt < NOW()
         OR createdAt < DATE_SUB(NOW(), INTERVAL 2 HOUR)
    `);

    // Add index on token column for fast lookup (SEC-002)
    const indexes = await queryRunner.query(
      `SHOW INDEX FROM password_reset_tokens WHERE Key_name = 'IDX_prt_token'`,
    );
    if (!indexes || indexes.length === 0) {
      await queryRunner.query(
        `CREATE INDEX IDX_prt_token ON password_reset_tokens (token)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_prt_token ON password_reset_tokens`,
    );
  }
}
