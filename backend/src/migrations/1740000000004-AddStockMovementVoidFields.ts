import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * GoBD-Konformität: Lagerbewegungen werden nicht mehr gelöscht, sondern storniert.
 * Felder für Soft-Void (isVoided, voidedAt, voidedBy, voidReason).
 */
export class AddStockMovementVoidFields1740000000004 implements MigrationInterface {
  name = "AddStockMovementVoidFields1740000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` ADD \`isVoided\` tinyint NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` ADD \`voidedAt\` timestamp NULL DEFAULT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` ADD \`voidedBy\` varchar(120) NULL DEFAULT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` ADD \`voidReason\` varchar(255) NULL DEFAULT NULL`
    );
    // Index für schnelle Abfrage aktiver (nicht stornierter) Buchungen
    await queryRunner.query(
      `CREATE INDEX \`idx_sm_is_voided\` ON \`stock_movements\` (\`isVoided\`)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`idx_sm_is_voided\` ON \`stock_movements\``);
    await queryRunner.query(`ALTER TABLE \`stock_movements\` DROP COLUMN \`voidReason\``);
    await queryRunner.query(`ALTER TABLE \`stock_movements\` DROP COLUMN \`voidedBy\``);
    await queryRunner.query(`ALTER TABLE \`stock_movements\` DROP COLUMN \`voidedAt\``);
    await queryRunner.query(`ALTER TABLE \`stock_movements\` DROP COLUMN \`isVoided\``);
  }
}
