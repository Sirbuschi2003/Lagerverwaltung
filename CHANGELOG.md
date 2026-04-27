# Changelog

## [3.6.2] – 2026-04-27

### Feature: Schnellbuchung – konfigurierbarer Startfokus

- Neuer Toggle „Workflow" direkt im Schnellbuchungs-Formular
- **EIN (Vorgangsnummer → Artikel):** Fokus landet beim Öffnen und nach Übernehmen auf dem Vorgangsnummer-Feld (z.B. Tonerlager)
- **AUS (Direkt Artikel):** Fokus landet beim Öffnen und nach Übernehmen direkt auf dem Barcode-Feld (z.B. Teilelager)
- Einstellung wird pro Gerät in `localStorage` gespeichert und bleibt nach Browser-Neustart erhalten

### Bugfix: Offene Anforderungen – Lager-Trennung (Teilelager vs. Tonerlager)

- Lagermitarbeiter sahen bisher alle offenen Fehlbestandsmeldungen aller Lager ihrer Niederlassung
- Jetzt werden nur noch Anforderungen angezeigt, deren Artikel im eigenen Lager gelagert sind (Lagerort-Hierarchie-Filter über `locationIds`)
- Andere Niederlassungen waren bereits durch den `branchId`-Filter isoliert

---

## [3.6.1] – 2026-04-27

### Feature: Schnellbuchung – UX-Verbesserungen (Fokus & Freitextsuche)

- Beim Start liegt der Fokus automatisch auf dem Vorgangsnummer-Feld; Enter springt in das Barcode-Feld
- Nach „Übernehmen" springt der Fokus zurück auf die Vorgangsnummer und leert das Feld
- Buchungsart wechseln setzt den Fokus ebenfalls auf das Barcode-Feld
- Barcode-Feld unterstützt jetzt Freitextsuche ab 2 Zeichen: Treffer in Artikelcode, Bezeichnung 1 und Bezeichnung 2 (max. 15 Ergebnisse)

### Feature: Bewegungshistorie – Pagination & Serverfilter

- Serverseitige Pagination: Standard 50 Zeilen, wählbar 25 / 50 / 100
- Suche nach Vorgangsnummer/Quelle wird jetzt als SQL-LIKE im Backend ausgeführt (war bisher client-seitig)
- Max. Limit auf 500 reduziert (war 1000)

### Feature: Inventur – Zuweisung an einzelnen Benutzer

- Manager können beim Erstellen einer Inventursitzung einen Benutzer aus der Niederlassung zuweisen
- Nicht-Manager sehen nur eigene oder nicht zugewiesene Sitzungen; Manager sehen weiterhin alle

### Bugfix: Dashboard – Offene Anforderungen für Lagermitarbeiter nicht sichtbar

- Lagermitarbeiter (kein Fahrzeug, aber Lagerort zugewiesen) sahen das Widget „Offene Anforderungen" nicht, obwohl Techniker Fehlbestände gemeldet hatten
- Widget erkennt jetzt Lagermitarbeiter anhand fehlender Fahrzeug-ID + vorhandener Lagerortzuweisung und lädt die Fleet-Anforderungen automatisch

---

## [3.6.0] – 2026-04-22

### Feature: Lager-Trennung in Berichten & Bewegungshistorie

- Artikel-Auswertung und Bewegungshistorie filtern jetzt strikt nach dem gewählten Lager – Toner-Artikel erscheinen nicht mehr in Teilelager-Berichten und umgekehrt
- Neuer `ArticleDetailDialog`: Klick auf einen Artikel in der Artikel-Auswertung öffnet eine Detailansicht mit vollständiger Buchungshistorie des Artikels im gewählten Zeitraum

### Feature: Schnellbuchung – Bestandsanzeige in Echtzeit

- Artikel-Info zeigt jetzt den aktuell verfügbaren Lagerbestand direkt neben dem Artikel
- Buchungsliste (CHECKIN/CHECKOUT) zeigt den virtuellen Bestand nach der geplanten Buchung – Überentnahmen werden sofort sichtbar

### Bugfix: Schnellbuchung – CHECKIN ohne Lagerort buchte lautlos in Leere

- CHECKIN-Buchungen ohne gewählten Lagerort wurden zuvor stillschweigend ignoriert
- Fehlermeldung wird jetzt korrekt angezeigt; Buchung wird blockiert bis ein Lagerort gewählt ist

### Bugfix: Unter-Sollbestand-Tabelle – falscher Sollbestand bei Mindestbestand

- Wenn für einen Artikel ein Mindestbestand (`minimumStock`) gesetzt war, zeigte die Tabelle den Mindestbestand als Sollbestand an statt dem tatsächlichen `targetStock`

### Bugfix: Dashboard-Crash bei gelöschten Artikeln

- `DashboardRestockWidget` crashte mit „Cannot read properties of null" wenn eine Bewegung auf einen inzwischen gelöschten Artikel zeigte
- Null-Check ergänzt; betroffene Einträge werden jetzt übersprungen

### Bugfix: CSV-Import erkennt `Produktgruppe`-Spalte

- CSV-Dateien mit der Spaltenbezeichnung `Produktgruppe` (statt `Warengruppe`) wurden bisher nicht erkannt
- Beide Varianten werden jetzt akzeptiert

### Bugfix: Hyreka-Import – Warengruppe wird nicht mehr überschrieben

- Beim Hyreka-Import wurde die Warengruppe bestehender Artikel mit einem leeren Fallback-Wert überschrieben
- Leere Werte aus dem Import werden jetzt ignoriert; bestehende Warengruppe bleibt erhalten

### Docs: CSV-Import-Dialog mit vollständiger Spalten-Dokumentation

- Der Import-Dialog listet jetzt alle unterstützten Spalten mit Beschreibung, Pflichtfeldern und Beispielwerten

### Performance: Fehlende Datenbankindizes ergänzt

- 7 neue Indizes für `stock_movements`, `stock_levels` und `items` – verhindert Full-Table-Scans bei wachsendem Datenvolumen und mehreren Niederlassungen
- Composite-Index `(itemId, occurredAt)` und `(vehicleId, occurredAt)` beschleunigen Bewegungshistorie und Reports spürbar
- Composite-Index `(branchId, targetStock)` auf `items` beschleunigt die Bestellvorschläge-Berechnung

### Performance: Techniker-Map gecacht

- Fleet-Overview wurde bei jedem Poll-Request (alle 15 s) komplett neu aus der DB geladen
- User-Daten werden jetzt 5 Minuten in-memory gecacht → reduziert DB-Last beim Dashboard deutlich

### Performance: Doppeltes Polling im Dashboard entfernt

- `DashboardRestockWidget` pollte intern doppelt (manuelles Intervall + `useLiveFleetStock`)
- Redundanter `setInterval`-Block entfernt; `useLiveFleetStock` übernimmt das Polling allein

---

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
