import { MigrationInterface, QueryRunner } from 'typeorm';

// GOB-003: Einstandspreise für Bestellpositionen (§240 HGB Bestandsbewertung)
// unitPriceNet  – Netto-Einstandspreis pro Einheit (DECIMAL 12,4)
// taxRate       – Steuersatz in Prozent, Standard 19 % (DECIMAL 5,2)
// currency      – ISO-4217 Währungscode, Standard EUR (VARCHAR 3)
export class AddPricesToPurchaseOrderLines1755700000000 implements MigrationInterface {
  name = 'AddPricesToPurchaseOrderLines1755700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_order_lines
        ADD COLUMN unit_price_net  DECIMAL(12,4) NULL         COMMENT 'Netto-Einstandspreis pro Einheit (§240 HGB)',
        ADD COLUMN tax_rate        DECIMAL(5,2)  NULL DEFAULT 19.00 COMMENT 'Steuersatz in Prozent (Standard 19)',
        ADD COLUMN currency        VARCHAR(3)    NOT NULL DEFAULT 'EUR' COMMENT 'ISO-4217 Waehrungscode'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_order_lines
        DROP COLUMN unit_price_net,
        DROP COLUMN tax_rate,
        DROP COLUMN currency
    `);
  }
}
