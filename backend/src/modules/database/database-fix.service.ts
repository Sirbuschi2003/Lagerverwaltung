import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { DataSource } from "typeorm";

/**
 * Service für automatische Datenbank-Korrekturen beim Start.
 * Wird vor den regulären Migrationen ausgeführt.
 */
@Injectable()
export class DatabaseFixService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseFixService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    await this.fixInventorySessionStatus();
  }

  /**
   * Korrigiert alte/ungültige Status-Werte in inventory_sessions.
   * Wird benötigt, wenn Backups mit alten Status-Werten (z.B. "ACTIVE") wiederhergestellt werden.
   */
  private async fixInventorySessionStatus() {
    try {
      // Prüfe, ob die Tabelle existiert
      const tableExists = await this.dataSource.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = 'inventory_sessions'
      `);

      if (!tableExists || tableExists[0]?.count === 0) {
        this.logger.log("inventory_sessions Tabelle existiert noch nicht - überspringe Status-Fix");
        return;
      }

      // Prüfe, ob die status-Spalte existiert
      const columnExists = await this.dataSource.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() 
        AND table_name = 'inventory_sessions' 
        AND column_name = 'status'
      `);

      if (!columnExists || columnExists[0]?.count === 0) {
        this.logger.log("status-Spalte existiert noch nicht - überspringe Status-Fix");
        return;
      }

      // Zähle Sessions mit ungültigen Status
      const invalidCount = await this.dataSource.query(`
        SELECT COUNT(*) as count 
        FROM inventory_sessions 
        WHERE status NOT IN ('DRAFT', 'SUBMITTED', 'FINALIZED', 'CANCELLED')
           OR status IS NULL 
           OR status = ''
      `);

      if (invalidCount[0]?.count > 0) {
        this.logger.warn(
          `Gefunden: ${invalidCount[0].count} Inventur-Session(s) mit ungültigem Status - korrigiere auf DRAFT...`,
        );

        // Korrigiere ungültige Werte
        const result = await this.dataSource.query(`
          UPDATE inventory_sessions 
          SET status = 'DRAFT' 
          WHERE status NOT IN ('DRAFT', 'SUBMITTED', 'FINALIZED', 'CANCELLED')
             OR status IS NULL 
             OR status = ''
        `);

        this.logger.log(
          `✅ ${result.affectedRows || invalidCount[0].count} Inventur-Session(s) auf DRAFT korrigiert`,
        );
      } else {
        this.logger.log("✅ Alle Inventur-Session Status sind gültig");
      }
    } catch (error) {
      // Fehler nur loggen, aber nicht den Start blockieren
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("Fehler beim Status-Fix:", message);
    }
  }
}
