import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fügt alle granularen Berechtigungen aus permissionMeta.ts in die DB ein
 * und weist sie den Standardrollen zu.
 * INSERT IGNORE: Bestehende Einträge werden nicht überschrieben.
 */
export class AddGranularPermissions1740000000007 implements MigrationInterface {
  name = "AddGranularPermissions1740000000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const allPerms: Array<[string, string]> = [
      // Ansichten
      ["dashboard.view", "Dashboard ansehen"],
      ["fleet.view", "Fahrzeugbestände ansehen"],
      ["myvehicle.view", "Eigenes Fahrzeug (Techniker-Ansicht)"],
      // Tools
      ["scanner.use", "QR-/Barcode-Scanner verwenden"],
      ["sync.use", "Offline-Sync verwenden"],
      ["quick-booking.use", "Schnellbuchung verwenden"],
      // Artikel
      ["items.view", "Artikel ansehen"],
      ["items.create", "Artikel anlegen"],
      ["items.edit", "Artikel bearbeiten"],
      ["items.delete", "Artikel löschen"],
      ["items.import", "Artikel importieren (CSV / Hyreka)"],
      ["items.export", "Artikel exportieren (CSV)"],
      // Fahrzeuge
      ["vehicles.view", "Fahrzeuge ansehen"],
      ["vehicles.create", "Fahrzeuge anlegen"],
      ["vehicles.edit", "Fahrzeuge bearbeiten"],
      ["vehicles.delete", "Fahrzeuge löschen"],
      // Lagerorte
      ["locations.view", "Lagerorte ansehen"],
      ["locations.create", "Lagerorte anlegen"],
      ["locations.edit", "Lagerorte bearbeiten"],
      ["locations.delete", "Lagerorte löschen"],
      // Benutzer
      ["users.view", "Benutzer ansehen"],
      ["users.create", "Benutzer anlegen"],
      ["users.edit", "Benutzer bearbeiten"],
      ["users.delete", "Benutzer löschen"],
      // Bestand
      ["stock.manage", "Bestand verwalten (Klonen, Massenaktion)"],
      // Restock
      ["restock.view", "Restock-Anfragen ansehen"],
      ["restock.create", "Restock-Anfragen erstellen"],
      ["restock.edit", "Restock-Anfragen bearbeiten"],
      ["restock.delete", "Restock-Anfragen löschen"],
      // Lieferanten
      ["suppliers.view", "Lieferanten ansehen"],
      ["suppliers.create", "Lieferanten anlegen"],
      ["suppliers.edit", "Lieferanten bearbeiten"],
      ["suppliers.delete", "Lieferanten löschen"],
      // Bestellungen
      ["orders.view", "Bestellungen ansehen"],
      ["orders.create", "Bestellungen anlegen"],
      ["orders.edit", "Bestellungen bearbeiten"],
      ["orders.receive", "Wareneingang buchen"],
      ["orders.send", "Bestellungen versenden"],
      ["orders.delete", "Bestellungen löschen"],
      // Inventur
      ["inventory.view", "Inventur ansehen"],
      ["inventory.create", "Inventur erstellen"],
      ["inventory.execute", "Inventur durchführen (Zählen)"],
      ["inventory.finalize", "Inventur abschließen"],
      ["inventory.template", "Inventur-Vorlage verwalten"],
      // Reports
      ["reports.view", "Reports ansehen"],
      ["reports.export", "Reports exportieren (PDF/Excel)"],
      // Rechteverwaltung
      ["access.manage", "Rollen & Rechte verwalten"],
    ];

    for (const [key, desc] of allPerms) {
      await queryRunner.query(
        `INSERT IGNORE INTO permissions (perm_key, description) VALUES (?, ?)`,
        [key, desc]
      );
    }

    const extractRows = (raw: any): any[] => {
      if (Array.isArray(raw)) {
        if (raw.length > 0 && Array.isArray(raw[0])) return raw[0];
        return raw;
      }
      return [];
    };

    const permRows = extractRows(await queryRunner.query(`SELECT id, perm_key AS permKey FROM permissions`));
    const permIdByKey = new Map<string, number>(permRows.map((p: any) => [p.permKey, p.id]));

    const roleRows = extractRows(await queryRunner.query(`SELECT id, name FROM roles`));
    const roleIdByName = new Map<string, number>(roleRows.map((r: any) => [r.name, r.id]));

    const assign = async (roleName: string, keys: string[]) => {
      const roleId = roleIdByName.get(roleName);
      if (!roleId) return;
      for (const key of keys) {
        const permId = permIdByKey.get(key);
        if (!permId) continue;
        await queryRunner.query(
          `INSERT IGNORE INTO role_permissions (roleId, permissionId) VALUES (?, ?)`,
          [roleId, permId]
        );
      }
    };

    // MANAGER bekommt alle Rechte
    await assign("MANAGER", allPerms.map((p) => p[0]));

    // WAREHOUSE
    await assign("WAREHOUSE", [
      "dashboard.view",
      "fleet.view",
      "items.view",
      "quick-booking.use",
      "scanner.use",
      "sync.use",
      "stock.read",
      "stock.write",
      "stock.manage",
      "movements.view",
      "restock.view",
      "restock.create",
      "restock.edit",
      "restock.manage",
      "suppliers.view",
      "orders.view",
      "orders.create",
      "orders.edit",
      "orders.receive",
      "orders.send",
      "locations.view",
      "reports.view",
      "reports.export",
      "inventory.view",
    ]);

    // TECHNICIAN
    await assign("TECHNICIAN", [
      "dashboard.view",
      "items.view",
      "myvehicle.view",
      "quick-booking.use",
      "scanner.use",
      "sync.use",
      "stock.read",
      "stock.write",
      "movements.view",
      "restock.view",
      "restock.create",
      "inventory.view",
      "inventory.execute",
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Nur die neu hinzugefügten Permissions entfernen (nicht die aus der ersten Migration)
    const newKeys = [
      "dashboard.view", "fleet.view", "myvehicle.view",
      "scanner.use", "sync.use", "quick-booking.use",
      "items.view", "items.create", "items.edit", "items.delete", "items.import", "items.export",
      "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.delete",
      "locations.view", "locations.create", "locations.edit", "locations.delete",
      "users.view", "users.create", "users.edit", "users.delete",
      "stock.manage",
      "restock.view", "restock.create", "restock.edit", "restock.delete",
      "suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.delete",
      "orders.view", "orders.create", "orders.edit", "orders.receive", "orders.send", "orders.delete",
      "inventory.view", "inventory.create", "inventory.execute", "inventory.finalize", "inventory.template",
      "reports.view", "reports.export",
      "access.manage",
    ];
    for (const key of newKeys) {
      await queryRunner.query(`DELETE FROM permissions WHERE perm_key = ?`, [key]);
    }
  }
}
