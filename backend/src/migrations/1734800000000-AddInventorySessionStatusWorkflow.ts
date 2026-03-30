import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Fügt Status-Workflow für Inventur-Sessions hinzu:
 * - DRAFT: Techniker zählt/editiert
 * - SUBMITTED: Techniker "Fertig (zur Prüfung)"; keine Änderungen mehr für Techniker
 * - FINALIZED: Manager finalisiert; unveränderbar, druckbar
 * - CANCELLED: Optional, für Sonderfälle
 * 
 * Zusätzliche Felder:
 * - submittedBy/At: Wer/Wann "Fertig (zur Prüfung)" gedrückt
 * - finalizedBy/At: Wer/Wann Manager finalisiert
 * - clientChecksum: Checksumme vom Client (SHA-256)
 * - serverChecksum: Checksumme vom Server (Validierung)
 */
export class AddInventorySessionStatusWorkflow1734800000000 implements MigrationInterface {
  name = "AddInventorySessionStatusWorkflow1734800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("inventory_sessions");
    if (!table) {
      throw new Error("inventory_sessions table not found");
    }

    // 1. Status-Feld (ENUM)
    const hasStatus = table.findColumnByName("status");
    if (!hasStatus) {
      await queryRunner.addColumn(
        "inventory_sessions",
        new TableColumn({
          name: "status",
          type: "enum",
          enum: ["DRAFT", "SUBMITTED", "FINALIZED", "CANCELLED"],
          default: "'DRAFT'",
          isNullable: false,
        }),
      );
    }

    // 2. submittedBy (Techniker, der "Fertig" gedrückt hat)
    const hasSubmittedBy = table.findColumnByName("submittedBy");
    if (!hasSubmittedBy) {
      await queryRunner.addColumn(
        "inventory_sessions",
        new TableColumn({
          name: "submittedBy",
          type: "varchar",
          length: "120",
          isNullable: true,
        }),
      );
    }

    // 3. submittedAt
    const hasSubmittedAt = table.findColumnByName("submittedAt");
    if (!hasSubmittedAt) {
      await queryRunner.addColumn(
        "inventory_sessions",
        new TableColumn({
          name: "submittedAt",
          type: "timestamp",
          isNullable: true,
        }),
      );
    }

    // 4. finalizedBy (Manager, der finalisiert hat)
    const hasFinalizedBy = table.findColumnByName("finalizedBy");
    if (!hasFinalizedBy) {
      await queryRunner.addColumn(
        "inventory_sessions",
        new TableColumn({
          name: "finalizedBy",
          type: "varchar",
          length: "120",
          isNullable: true,
        }),
      );
    }

    // 5. finalizedAt
    const hasFinalizedAt = table.findColumnByName("finalizedAt");
    if (!hasFinalizedAt) {
      await queryRunner.addColumn(
        "inventory_sessions",
        new TableColumn({
          name: "finalizedAt",
          type: "timestamp",
          isNullable: true,
        }),
      );
    }

    // 6. clientChecksum (SHA-256 vom Client)
    const hasClientChecksum = table.findColumnByName("clientChecksum");
    if (!hasClientChecksum) {
      await queryRunner.addColumn(
        "inventory_sessions",
        new TableColumn({
          name: "clientChecksum",
          type: "varchar",
          length: "64",
          isNullable: true,
        }),
      );
    }

    // 7. serverChecksum (Server-Validierung)
    const hasServerChecksum = table.findColumnByName("serverChecksum");
    if (!hasServerChecksum) {
      await queryRunner.addColumn(
        "inventory_sessions",
        new TableColumn({
          name: "serverChecksum",
          type: "varchar",
          length: "64",
          isNullable: true,
        }),
      );
    }

    // 8. Alle existierenden Sessions auf DRAFT setzen (backwards-compat)
    // Konvertiere NULL, leere Strings UND alle ungültigen alten Werte (z.B. "Active")
    await queryRunner.query(`
      UPDATE \`inventory_sessions\`
      SET status = 'DRAFT'
      WHERE status IS NULL 
         OR status = ''
         OR status NOT IN ('DRAFT', 'SUBMITTED', 'FINALIZED', 'CANCELLED')
    `);

    // 9. Index für Status (Performance bei Abfragen nach Status)
    await queryRunner.query(`
      CREATE INDEX \`IDX_inventory_sessions_status\` ON \`inventory_sessions\` (\`status\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("inventory_sessions");
    if (!table) return;

    // Index entfernen
    await queryRunner.query(`DROP INDEX \`IDX_inventory_sessions_status\` ON \`inventory_sessions\``);

    // Spalten entfernen
    const columns = [
      "serverChecksum",
      "clientChecksum",
      "finalizedAt",
      "finalizedBy",
      "submittedAt",
      "submittedBy",
      "status",
    ];

    for (const col of columns) {
      const hasCol = table.findColumnByName(col);
      if (hasCol) {
        await queryRunner.dropColumn("inventory_sessions", col);
      }
    }
  }
}
