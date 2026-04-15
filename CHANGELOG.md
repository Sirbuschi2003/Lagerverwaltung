# Changelog

## [3.4.1] – 2026-04-15

### Refactor: Lager-Zugriffskontrolle über Lagerorte (statt separater Warehouse-Tabelle)

Das gestrige Warehouse-Modul (separate `warehouses`-Tabelle) wurde durch eine sauberere Lösung ersetzt,
die das bereits vorhandene Lagerorte-System (Typ `WAREHOUSE`) nutzt.

**Entfernt:**
- Separates `warehouses`-Modul, -Tabelle und -Menüpunkt
- `warehouseId`-Spalten auf `users`, `items`, `purchase_orders`, `inventory_sessions`

**Neu:**
- `user_locations` Junction-Tabelle: Benutzer können mehreren WAREHOUSE-Lagerorten zugewiesen werden
- Benutzerverwaltung: Multi-Select für Lager-Zuweisung (aus bestehenden Lagerorten Typ=WAREHOUSE)
- Filterlogik: Benutzer mit Lager-Zuweisung sieht nur Artikel deren `storageLocation` im zugewiesenen Lager oder darunter liegt (Lager → Regal → Fach)
- JWT enthält `locationIds[]` statt `warehouseId`
- Locations-API: SuperAdmin kann `?branchId=...` übergeben

**Workflow:**
1. Lager in Lagerorte anlegen (Typ = Lager)
2. Regale/Fächer darunter anlegen
3. Benutzer dem Lager zuweisen (Benutzerverwaltung, Mehrfachauswahl)
4. Benutzer ohne Zuweisung sieht alle Lager der Niederlassung

---

## [3.4.0] – 2026-04-14

### Feature: Mehrere Lager (Warehouses) pro Niederlassung

*(Durch v3.4.1 vollständig ersetzt und vereinfacht)*

---

## [3.3.9] – 2026-04-10

### Feature: Berichte & Analysen

- Bewegungshistorie: neuer Tab „Berichte & Analysen"
- Filter nach Zeitraum, Artikel, Fahrzeug, Bewegungstyp
- Verbrauchstrend-Diagramm, Excel-Export

---

## [3.3.8] – 2026-04-08

### Bugfixes Purchasing-Modul

- Firmendaten in PDF/E-Mail branch-spezifisch
- Neues Bestellnummer-Format: `{NL-CODE}-{YYYYMMDD}-{001}-{HERST}`
- Neue PDF-Ordnerstruktur, neue Download-API
- Login Rate-Limit: 3 → 10 Versuche

---

## [3.3.0] – 2026-04-02

### Feature: Niederlassungsspezifische Einstellungen

- `branch_configs` Tabelle, Branch-Isolation, pro-branch SMTP
