import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Performance-Indizes für häufig gefilterte/sortierte Spalten.
 * Verhindert Full-Table-Scans bei wachsenden Datenmengen.
 */
export class AddPerformanceIndexes1740000000002 implements MigrationInterface {
  name = "AddPerformanceIndexes1740000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // stock_movements: zeitliche Abfragen + Duplikat-Erkennung + Artikel-Historie
    await queryRunner.query(
      `CREATE INDEX \`idx_sm_created_at\` ON \`stock_movements\` (\`createdAt\`)`
    );
    await queryRunner.query(
      `CREATE INDEX \`idx_sm_occurred_at\` ON \`stock_movements\` (\`occurredAt\`)`
    );
    await queryRunner.query(
      `CREATE INDEX \`idx_sm_source\` ON \`stock_movements\` (\`source\`)`
    );

    // system_logs: Audit-Suchen + Retention-Cleanup
    await queryRunner.query(
      `CREATE INDEX \`idx_sl_created_at\` ON \`system_logs\` (\`createdAt\`)`
    );
    await queryRunner.query(
      `CREATE INDEX \`idx_sl_category_created_at\` ON \`system_logs\` (\`category\`, \`createdAt\`)`
    );
    await queryRunner.query(
      `CREATE INDEX \`idx_sl_level_created_at\` ON \`system_logs\` (\`level\`, \`createdAt\`)`
    );

    // inventory_sessions: Status-Filter
    await queryRunner.query(
      `CREATE INDEX \`idx_is_status\` ON \`inventory_sessions\` (\`status\`)`
    );

    // purchase_orders: Status-Filter + Datum-Sortierung
    await queryRunner.query(
      `CREATE INDEX \`idx_po_status\` ON \`purchase_orders\` (\`status\`)`
    );
    await queryRunner.query(
      `CREATE INDEX \`idx_po_created_at\` ON \`purchase_orders\` (\`createdAt\`)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`idx_po_created_at\` ON \`purchase_orders\``);
    await queryRunner.query(`DROP INDEX \`idx_po_status\` ON \`purchase_orders\``);
    await queryRunner.query(`DROP INDEX \`idx_is_status\` ON \`inventory_sessions\``);
    await queryRunner.query(`DROP INDEX \`idx_sl_level_created_at\` ON \`system_logs\``);
    await queryRunner.query(`DROP INDEX \`idx_sl_category_created_at\` ON \`system_logs\``);
    await queryRunner.query(`DROP INDEX \`idx_sl_created_at\` ON \`system_logs\``);
    await queryRunner.query(`DROP INDEX \`idx_sm_source\` ON \`stock_movements\``);
    await queryRunner.query(`DROP INDEX \`idx_sm_occurred_at\` ON \`stock_movements\``);
    await queryRunner.query(`DROP INDEX \`idx_sm_created_at\` ON \`stock_movements\``);
  }
}
