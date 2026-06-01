import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDeliveryNotes1746400000000 implements MigrationInterface {
  name = "CreateDeliveryNotes1746400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE delivery_notes (
        id           VARCHAR(36)  NOT NULL PRIMARY KEY,
        vorgangsnummer VARCHAR(100) NOT NULL,
        filePath     VARCHAR(500) NOT NULL,
        branchId     VARCHAR(36)  NULL,
        detectedAt   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX idx_delivery_notes_vorgangsnummer (vorgangsnummer),
        INDEX idx_delivery_notes_branch (branchId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE delivery_notes`);
  }
}
