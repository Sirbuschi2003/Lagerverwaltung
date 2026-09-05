import { MigrationInterface, QueryRunner } from 'typeorm';

// DSGVO Art. 6/7: Consent tracking table
export class CreateUserConsents1755800000000 implements MigrationInterface {
  name = 'CreateUserConsents1755800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_consents (
        id          VARCHAR(36)  NOT NULL DEFAULT (UUID()),
        userId      VARCHAR(36)  NOT NULL COMMENT 'References users.id (soft FK, no cascade — survives anonymization)',
        purpose     VARCHAR(100) NOT NULL COMMENT 'Consent purpose: analytics, marketing, necessary, etc.',
        version     VARCHAR(20)  NOT NULL COMMENT 'Consent text version shown to user',
        granted     TINYINT(1)   NOT NULL DEFAULT 1,
        ipAddress   VARCHAR(40)  NULL     COMMENT 'Anonymized IP at consent time',
        userAgent   VARCHAR(512) NULL,
        grantedAt   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        revokedAt   DATETIME     NULL,
        PRIMARY KEY (id),
        INDEX IDX_consent_userId (userId),
        INDEX IDX_consent_purpose (purpose),
        INDEX IDX_consent_userId_purpose (userId, purpose)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_consents`);
  }
}
