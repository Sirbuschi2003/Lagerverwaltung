# Changelog

## [3.5.1] – 2026-04-17

### Feature: Selektive Wiederherstellung aus Backup

- Backup enthält jetzt alle Daten (Artikel, Bestände, Buchungshistorie, Bestellungen, Lieferanten, Lagerorte, Benutzer, Fahrzeuge, Niederlassungen, System-Konfiguration)
- Granulare Auswahl: jede Datenkategorie einzeln aktivierbar/deaktivierbar vor dem Restore
- Vollständige Transaktion mit automatischem Rollback bei Fehler – kein Datenverlust bei Teilfehler
- `PayloadTooLargeError` bei großen Backups behoben (Limit auf 200 MB erhöht)
- Restore-Timeout von 3 s auf 300 s erhöht; Axios statt `fetch` für konsistente Auth-Header
- Niederlassungen werden jetzt ebenfalls wiederhergestellt
- Alte Backup-Versionen (< 2.0) werden erkannt und mit verständlicher Fehlermeldung abgelehnt

### Bugfix: Backup-Wiederherstellung – Datenvollständigkeit

- `purchase_orders`: fehlende Felder `branchId`, `locationId`, `deliveryNoteNumber` ergänzt (verhinderte zuvor DB-Fehler „Field has no default value")
- `items`: fehlende Felder in der Restore-Abbildung ergänzt
- **BackupPage:** `fetch`-Aufruf mit veralteter `token`-Variable durch korrekte `api`-Axios-Instanz ersetzt

### Bugfix: Bestandswiederherstellung nach Hyreka-Import

- Nach einem Hyreka-Import haben Artikel neue UUIDs – die alten Backup-IDs sind ungültig
- StockLevels und StockMovements werden jetzt über den Artikelcode auf die aktuellen DB-IDs gemappt
- Bestände erscheinen nach Wiederherstellung wieder korrekt in der Flottenübersicht

### Bugfix: Absturz bei gelöschten Artikeln mit verwaisten Beständen

- `getFleetOverview`, `getVehicleStock`, `getRestockOverview` (Backend) und `DashboardRestockWidget` (Frontend) crashten mit „cannot read property of null" wenn StockLevels auf gelöschte Artikel zeigten
- Null-Checks an allen betroffenen Stellen ergänzt

### Bugfix: Hyreka-Import – Artikel landen im falschen Lager

- **Scoped-Key-Kollision:** Gleiche Regalnamen in verschiedenen Lagern wurden falsch zugeordnet → Toner-Artikel landeten im Teilelager. Scoped-Lookup ist jetzt strikt: nur Treffer im gewählten Ziellager werden verwendet.
- **Artikel ohne CSV-Lagerort:** `??`-Operator fängt leere Strings nicht ab – durch `||` ersetzt. Artikel ohne Lagerort in der CSV werden nun korrekt dem gewählten übergeordneten Lager zugewiesen.

### Feature: Filter „Ohne Lagerort" in der Artikelliste

- Manager können Artikel ohne hinterlegten Lagerort direkt filtern (Checkbox in der Artikelliste)
- Anzeige alphabetisch sortiert nach Artikelnummer – hilfreich nach Importen zur Qualitätskontrolle

### Bugfix: Rate-Limit – Login nach Bulk-Import blockiert

- Globales Rate-Limit von 100 auf 500 Anfragen/Minute erhöht – Bulk-Importe erschöpfen das Limit nicht mehr
- Login-Throttle (10 Versuche / 15 Min) wird durch Container-Neustart sofort zurückgesetzt

### Performance: Bestandsabgleich im Hyreka-Import massiv beschleunigt

- Statt bis zu 10.000 Einzelrequests werden alle Bestandskorrekturen gesammelt und in 250er-Batches über `/stock/sync` übertragen
- Bei 10.000 Artikeln: ~40 statt ~10.000 HTTP-Requests → von >10 Minuten auf ~20 Sekunden

### Bugfix: TypeScript-Kompilierfehler

- `@types/socket.io-client` entfernt – verursachte Typkonflikt mit `socket.io-client` v4

---

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
