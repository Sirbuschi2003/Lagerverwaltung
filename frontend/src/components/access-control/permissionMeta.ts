export const permissionMeta: Record<
  string,
  {
    label: string;
    features?: string[];
    category?: string;
  }
> = {
  // Ansichten
  "dashboard.view": { label: "Dashboard", features: ["Dashboard"], category: "Ansichten" },
  "fleet.view": { label: "Fahrzeugbestände", features: ["Fahrzeugbestände"], category: "Ansichten" },
  "items.view": { label: "Artikel ansehen", features: ["Artikelübersicht"], category: "Artikel" },
  "myvehicle.view": { label: "Eigenes Fahrzeug", features: ["Techniker-Ansicht"], category: "Ansichten" },
  
  // Scanner & Sync & Buchung
  "scanner.use": { label: "Scanner", features: ["QR-Scanner"], category: "Tools" },
  "sync.use": { label: "Offline-Sync", features: ["PWA-Sync"], category: "Tools" },
  "quick-booking.use": { label: "Schnellbuchung", features: ["Schnellbuchung-Seite"], category: "Tools" },

  // Artikel CRUD
  "items.create": { label: "Artikel anlegen", features: ["Neue Artikel"], category: "Artikel" },
  "items.edit": { label: "Artikel bearbeiten", features: ["Artikel ändern"], category: "Artikel" },
  "items.delete": { label: "Artikel löschen", features: ["Artikel entfernen"], category: "Artikel" },
  "items.import": { label: "Artikel importieren", features: ["CSV-Import", "Hyreka-Import"], category: "Artikel" },
  "items.export": { label: "Artikel exportieren", features: ["CSV-Export"], category: "Artikel" },
  
  // Fahrzeuge CRUD
  "vehicles.view": { label: "Fahrzeuge ansehen", features: ["Fahrzeugübersicht"], category: "Fahrzeuge" },
  "vehicles.create": { label: "Fahrzeuge anlegen", features: ["Neue Fahrzeuge"], category: "Fahrzeuge" },
  "vehicles.edit": { label: "Fahrzeuge bearbeiten", features: ["Fahrzeuge ändern"], category: "Fahrzeuge" },
  "vehicles.delete": { label: "Fahrzeuge löschen", features: ["Fahrzeuge entfernen"], category: "Fahrzeuge" },

  // Lagerorte
  "locations.view": { label: "Lagerorte ansehen", features: ["Lagerorte"], category: "Lager" },
  "locations.create": { label: "Lagerorte anlegen", features: ["Neue Lagerorte"], category: "Lager" },
  "locations.edit": { label: "Lagerorte bearbeiten", features: ["Lagerorte ändern"], category: "Lager" },
  "locations.delete": { label: "Lagerorte löschen", features: ["Lagerorte entfernen"], category: "Lager" },
  
  // Benutzer CRUD
  "users.view": { label: "Benutzer ansehen", features: ["Benutzerliste"], category: "Benutzer" },
  "users.create": { label: "Benutzer anlegen", features: ["Neue Benutzer"], category: "Benutzer" },
  "users.edit": { label: "Benutzer bearbeiten", features: ["Benutzer ändern"], category: "Benutzer" },
  "users.delete": { label: "Benutzer löschen", features: ["Benutzer entfernen"], category: "Benutzer" },
  
  // Bestand
  "stock.read": { label: "Bestand lesen", features: ["Artikel-Details", "Bestandsabfrage"], category: "Bestand" },
  "stock.write": { label: "Bestand buchen", features: ["Ein-/Ausbuchen"], category: "Bestand" },
  "stock.manage": { label: "Bestand verwalten", features: ["Klonen", "Massenaktion"], category: "Bestand" },
  "movements.view": { label: "Bewegungen ansehen", features: ["Bewegungsverlauf"], category: "Bestand" },
  "movements.cleanup": { label: "Bewegungen bereinigen", features: ["Cleanup"], category: "Bestand" },
  
  // Restock
  "restock.view": { label: "Restock ansehen", features: ["Restock-Liste"], category: "Restock" },
  "restock.create": { label: "Restock erstellen", features: ["Neue Anfragen"], category: "Restock" },
  "restock.edit": { label: "Restock bearbeiten", features: ["Anfragen ändern"], category: "Restock" },
  "restock.delete": { label: "Restock löschen", features: ["Anfragen entfernen"], category: "Restock" },

  // Lieferanten
  "suppliers.view": { label: "Lieferanten ansehen", features: ["Lieferantenliste"], category: "Einkauf" },
  "suppliers.create": { label: "Lieferanten anlegen", features: ["Neue Lieferanten"], category: "Einkauf" },
  "suppliers.edit": { label: "Lieferanten bearbeiten", features: ["Lieferanten ändern"], category: "Einkauf" },
  "suppliers.delete": { label: "Lieferanten löschen", features: ["Lieferanten entfernen"], category: "Einkauf" },

  // Bestellungen
  "orders.view": { label: "Bestellungen ansehen", features: ["Bestellübersicht"], category: "Einkauf" },
  "orders.create": { label: "Bestellungen anlegen", features: ["Bestellung erstellen"], category: "Einkauf" },
  "orders.edit": { label: "Bestellungen bearbeiten", features: ["Bestellung ändern"], category: "Einkauf" },
  "orders.receive": { label: "Wareneingang buchen", features: ["Wareneingang"], category: "Einkauf" },
  "orders.send": { label: "Bestellungen versenden", features: ["Bestellung senden"], category: "Einkauf" },
  "orders.delete": { label: "Bestellungen löschen", features: ["Bestellung löschen"], category: "Einkauf" },
  
  // Inventur
  "inventory.view": { label: "Inventur ansehen", features: ["Inventurübersicht"], category: "Inventur" },
  "inventory.create": { label: "Inventur erstellen", features: ["Neue Inventur"], category: "Inventur" },
  "inventory.execute": { label: "Inventur durchführen", features: ["Zählen"], category: "Inventur" },
  "inventory.manage": { label: "Inventur verwalten", features: ["Inventurverwaltung"], category: "Inventur" },
  "inventory.finalize": { label: "Inventur abschließen", features: ["Abschluss"], category: "Inventur" },
  "inventory.template": { label: "Inventur-Vorlage", features: ["Template"], category: "Inventur" },
  
  // Reports
  "reports.view": { label: "Reports ansehen", features: ["Berichte"], category: "Reports" },
  "reports.export": { label: "Reports exportieren", features: ["PDF/Excel Export"], category: "Reports" },
  
  // Einstellungen
  "settings.company": { label: "Firmendaten", features: ["Firmendaten"], category: "Einstellungen" },
  "settings.email": { label: "E-Mail", features: ["E-Mail Einstellungen"], category: "Einstellungen" },
  "backup.access": { label: "Backups", features: ["Datensicherung"], category: "Einstellungen" },
  "logs.view": { label: "Logs", features: ["Systemprotokolle"], category: "Einstellungen" },
  "access.manage": { label: "Rechteverwaltung", features: ["Rollen & Rechte"], category: "Einstellungen" },
};
