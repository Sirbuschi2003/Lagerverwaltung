import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokensTable1755100000000 implements MigrationInterface {
  name = "AddRefreshTokensTable1755100000000";

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id VARCHAR(36) PRIMARY KEY,
      userId VARCHAR(255) NOT NULL,
      tokenHash VARCHAR(64) NOT NULL UNIQUE,
      expiresAt DATETIME NOT NULL,
      revokedAt DATETIME NULL,
      isRevoked TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX idx_rt_userId (userId),
      INDEX idx_rt_isRevoked (isRevoked)
    ) ENGINE=InnoDB`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query("DROP TABLE IF EXISTS refresh_tokens");
  }
}
