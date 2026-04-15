import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: locationId-Spalte in purchase_orders
 *
 * Ermöglicht Lager-basierte Filterung und Ablage von Bestellungen
 * unter Niederlassung/Lager/Jahr/Monat/
 */
export class AddLocationIdToPurchaseOrders1745200000000 implements MigrationInterface {
  name = "AddLocationIdToPurchaseOrders1745200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD \`locationId\` char(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD CONSTRAINT \`FK_purchase_orders_location\` FOREIGN KEY (\`locationId\`) REFERENCES \`locations\`(\`id\`) ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP FOREIGN KEY \`FK_purchase_orders_location\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`locationId\``,
    );
  }
}
