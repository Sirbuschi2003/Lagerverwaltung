# Changelog

## [3.5.0] – 2026-04-16

### Feature: Lager zurücksetzen (Artikelstamm-Neustart)

- Neuer Bereich in **Wartung & Update**: "Lager zurücksetzen"
- Vorschau zeigt exakte Anzahl: Artikel, Bestände (inkl. Technikerfahrzeuge), Buchungshistorie, Lagerorte
- Option: Lagerorte (Regale/Fächer) ebenfalls löschen
- Doppelte Sicherheitsabfrage: Textbestätigung `LÖSCHEN` + Checkbox
- Cascade-Löschung auf DB-Ebene entfernt StockLevels, StockMovements und RestockRequests automatisch
- Niederlassungsadmin kann nur seine eigene Niederlassung zurücksetzen

### Feature: Schnellbuchung – Echtzeit-Sync PC ↔ Handy

- Buchungsliste wird über Socket.io in Echtzeit zwischen allen angemeldeten Geräten desselben Benutzers synchronisiert
- Scan auf dem Handy erscheint sofort auf dem PC-Bildschirm und umgekehrt
- "Übernehmen" und "Liste löschen" wirken auf allen verbundenen Geräten gleichzeitig
- Sync-Status-Banner zeigt an wenn Echtzeit-Verbindung aktiv ist
- Serverseitiger State-Cache: neu verbindende Geräte erhalten sofort den aktuellen Listenstand

### Feature: Schnellbuchung – Bestandsschutz beim Scannen

- CHECKOUT-Modus: System prüft vor jedem Scan ob Gesamtmenge (bereits in Liste + neuer Scan) den Lagerbestand überschreitet
- Bei Überschreitung: Warnton, Fehlermeldung mit verbleibender Restmenge, kein Listeneintrag
- Backend liefert `currentQuantity` jetzt direkt beim Artikel-Lookup per Code/Barcode mit

### Bugfix: Hyreka-Import – Lagerorte im falschen Lager

- **Ursache:** Beim Import wurden alle Lagerorte aller Niederlassungen für die Zuordnung herangezogen – dadurch wurde "Regal 1 / Fach 1" aus Lager 001 auch beim Import für Lager 002 gefunden
- **Fix Frontend:** `fetchLocations()` beim Import filtert jetzt nach `branchId` des eingeloggten Benutzers
- **Fix Backend:** Location-ID-Validierung beim Bulk-Import prüft jetzt auch ob der Lagerort zur eigenen Niederlassung gehört
- Neu angelegte Lagerorte während des Imports erhalten korrekte Niederlassungszugehörigkeit

### Bugfix: Berichte & Analysen – locationIds-Filter + neue Artikel-Auswertung

*(bereits in 3.4.1 enthalten, hier dokumentiert)*

- Auswertungen berücksichtigen `locationIds`-Filter korrekt
- Neue Artikel-Auswertung: Bestand nach Warengruppe/Hersteller

---

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
