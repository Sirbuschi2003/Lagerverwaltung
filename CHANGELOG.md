# Changelog

## [Unreleased] – seit 2026-06-01

### Feature: Duplikat-Warnung in der Schnellbuchung

- Beim Scannen eines Artikels wird geprüft, ob derselbe Artikel innerhalb des konfigurierbaren Zeitraums bereits an denselben Kunden ausgebucht wurde
- Kundennummer wird automatisch aus dem LFS-Format der Vorgangsnummer extrahiert (`LFS/461101/101574/400` → `461101`)
- Warnung erscheint **nicht-blockierend** auf der Seite – Scanner läuft weiter, Buchung kann normal abgeschlossen werden
- Die Warnung zeigt: Artikelcode, Kundennummer, Datum, ursprüngliche Vorgangsnummer und Menge
- Einzelne Warnungen können per ✕ geschlossen werden; alle Warnungen werden beim Übernehmen/Löschen automatisch geleert
- **Konfigurierbar pro Benutzer:** Toggle zum Ein-/Ausschalten + Zeitraum wählbar (1 / 2 / 3 / 6 / 12 Monate)
- Einstellungen werden serverseitig in der Datenbank gespeichert und gelten geräteübergreifend

### Feature: MySQL SQL-Dump über die Backup-Seite

- Direkter Download eines vollständigen SQL-Dumps (`.sql.gz`) von der Backup-Seite im Admin-Bereich
- Nützlich für manuelle Sicherungen oder Datenbankmigrationen

### Bugfix

- **Doppelte Offline-Ausbuchungen auf Mobilgeräten:** Doppel-Tap auf dem Touchscreen erzeugte zwei identische Buchungen – debounce im Offline-Queue-Handler ergänzt
- **Bestellvorschläge:** Verpackungseinheit (`packSize`) wird bei der Berechnung der Bestellmenge korrekt berücksichtigt
- **Report-Bestand:** Bestand zählt jetzt ausschließlich den primären Lagerort des Artikels (= gleicher Wert wie auf der Artikelseite)
- **Geister-StockLevels:** Einträge ohne Fahrzeug und ohne Lagerort (`vehicleId=null AND locationId=null`) werden aus dem Report-Bestand ausgeschlossen; Repair-Migration bereinigt bestehende Einträge
- **Verbrauchsprognose:** Bestand mischt nicht mehr Fahrzeug- und Fremdniederlassungs-Bestand
- **Bewegungshistorie:** Quelle `restock-prepare:{UUID}` wird jetzt als lesbare Bezeichnung dargestellt
- **Vorgangsnummer optional:** Buchungen ohne Vorgangsnummer erhalten Fallback `manual` im Audit-Trail
- **Bestellvorschläge – Zulauf:** Bereits bestellte aber noch nicht eingegangene Mengen werden in der „Benötigt"-Berechnung abgezogen und sichtbar angezeigt
- **Bestellvorschläge – Sortierung Wareneingang:** Sortierung nach Artikel-Nr. korrigiert
- **Lieferscheinnummern bei Teillieferungen:** Nummern werden jetzt angehängt statt überschrieben
- **Inventur-Crash nach Erstellen/Zuweisen:** Session-Liste lieferte seit dem Perf-Fix vom 11.05. keine Inventurzeilen mehr, wodurch die aktive Inventur ohne Positionen geladen wurde (Crash beim Rendern, Dubletten-Erkennung beim Scannen griff nicht). Neuer Detail-Endpoint lädt die aktive Session jetzt mit vollen Zeilen nach; die Liste liefert weiterhin nur eine Positionsanzahl (`linesCount`) für die Performance
- **Zugewiesene Inventur für Benutzer unsichtbar:** Vom Super-Admin (branchId=null) erstellte und einem Benutzer zugewiesene Inventuren wurden dem Benutzer nie angezeigt, da die Sichtbarkeitsprüfung strikt auf Gleichheit der Niederlassung filterte statt branchId=null als niederlassungsübergreifend zu behandeln. Betraf auch Submit/Reopen/Finalize/Export derselben Sessions
- **Dashboard-Kachel „Offene Inventuren":** Zeigte die Gesamtzahl aller offenen Inventuren systemweit an (alle Niederlassungen, ohne Zuweisungsfilter) statt nur der für den jeweiligen Benutzer sichtbaren
- **Sicherheit – Tab-Leiste zeigte Seiten des vorherigen Benutzers:** Die offenen Tabs (inkl. adminexklusiver Seiten wie Firmendaten) wurden beim Logout nicht geleert und blieben im `sessionStorage` erhalten. Meldete sich danach ein anderer Benutzer im selben Browser-Tab an, sah dieser die zuvor geöffneten Seiten des vorherigen Benutzers in der Tab-Leiste. Tabs werden jetzt beim Logout geleert

### Security & Integrity

- 5 kritische Buchungs- und Bestell-Fixes: doppelte Buchungsverhinderung, Mengen-Validierung, Branch-Isolation bei Bestellzeilen, Transaktionssicherheit
- Refactor: 3 fokussierte Sub-Services aus den Monolithen `StockService` und `PurchasingService` extrahiert (SRP)

---

## [3.9.0] – 2026-06-01

### Feature: Lieferschein-Zuordnung per Ordner-Watcher

- PDFs vom Kopierer werden automatisch erkannt: Ablage in `{NL-CODE}_{Name}/{YYYY}/{MM}/{Auftragsnummer}.pdf`
- Backend scannt den Ordner jede Minute und legt DB-Einträge an
- In der Bewegungshistorie erscheint ein PDF-Icon bei Buchungen mit vorhandenem Lieferschein
- Klick öffnet das PDF direkt im Browser-Tab
- Strenge Niederlassungs-Trennung: NL A sieht keine Lieferscheine von NL B
- Neue Env-Variable: `DELIVERY_NOTES_STORAGE_HOST_PATH` (z.B. `/volume1/docker/Lagerverwaltung/lieferscheine`)
- Neues Docker-Volume: `delivery_notes_data`

### Feature: Verbrauchsprognose in Berichte & Analysen

- Neuer Tab „Verbrauchsprognose" in Berichte & Analysen
- Zeiträume wählbar: 7 / 30 / 60 / 90 / 180 / 365 Tage
- Zeigt: Verbrauch, Verbrauch pro Tag, Reichweite in Tagen, Datenqualitäts-Warnung bei wenig Datenbasis
- Formel-Box erklärt die Berechnungsgrundlage; Spalten-Tooltips erläutern die Werte

### Feature: Reichweiten-Prognose in Bestellvorschlägen

- Bestellvorschläge zeigen jetzt die voraussichtliche Reichweite je Artikel in Tagen
- Basiert auf dem durchschnittlichen Verbrauch der letzten 90 Tage

### Feature: Fahrzeugbuchungen aus Berichten ausblenden

- Buchungen aus Fahrzeugen (Monteur-Entnahmen) werden in Berichten & Bewegungshistorie standardmäßig ausgeblendet
- Filteroption zum Einblenden bleibt vorhanden

### Feature: Tab-Leiste mit Keep-Alive + Artikel-Bilder Lightbox

- Haupt-Navigation als permanente Tab-Leiste: geöffnete Seiten bleiben im Speicher (kein Neu-Laden beim Tab-Wechsel)
- Artikel-Bilder können in einer Lightbox-Vollansicht betrachtet werden
- Bilder werden im Offline-Cache gespeichert

### Feature: Kamera-Upload & Artikel-Bilder in Fahrzeugkarten

- Im Artikeldialog können Fotos direkt per Kamera oder Datei-Upload hinzugefügt werden
- Artikel-Bilder erscheinen auf den Fahrzeugkarten in der mobilen Ansicht

### Bugfix

- Lieferschein-Auftragsnummer aus QR-Code (`LFS/.../101501/400`) wird korrekt für den Lieferschein-Lookup extrahiert
- Lieferscheine sind strikt niederlassungsisoliert; PDF-Öffnung erfordert Authentifizierung
- Ist-Bestand in Artikeldetails wird nach Schnellbuchung sofort aktualisiert (kein Refresh nötig)
- Fokus in der Schnellbuchung nach Löschen eines Listeneintrags korrigiert (`refocusBarcode` auf doppeltes `requestAnimationFrame` umgestellt)

## [3.8.0] – 2026-05-21

### Feature: Custom Scan-Töne

- Eigene Scan-Töne für Erfolg und Fehler hochladbar (WAV/MP3/OGG, max. 2 MB)
- Standard-Töne: schärfere Square-Wave-Synthese, höherer Gain, mehrere Beeps – deutlich penetranter / besser hörbar in lauter Umgebung
- Lautstärke wird direkt beim Laden maximiert (keine separate Lautstärke-Einstellung nötig)

### Feature: DB-Statistiken für Super-Admin

- Neuer Bereich in Wartung & Update: Datenbankstatistiken (Tabellengröße, Zeilenanzahl, Index-Größe)
- Buchungshistorie-Aufbewahrung konfigurierbar: ältere Bewegungen automatisch archivieren/löschen

### Feature: Wareneingang – Lieferscheinnummer-Bestätigung

- Beim Wareneingang ohne Lieferscheinnummer erscheint ein Bestätigungsdialog mit Inline-Eingabe
- Buchung kann direkt im Dialog mit Lieferscheinnummer abgeschlossen oder ohne fortgesetzt werden

### Feature: Bestell-PDF Designer – Felder pro Element konfigurierbar

- Im PDF-Designer können jetzt pro Tabellenelement gezielt Felder ein-/ausgeblendet werden
- Layout wird auf Basis des Niederlassungs-Templates gerendert (kein generisches Fallback mehr)

### Feature: Pre-Migration-Backup

- Vor jedem Datenbankupdate (Migration) wird automatisch ein Backup erstellt
- Schützt vor Datenverlust bei fehlgeschlagenen Migrationen

### Feature: Hyreka-Abgleich-Modus – Lieferanten beibehalten

- Neuer Modus beim Hyreka-Import: Lieferanten-Zuweisung bestehender Artikel wird nicht überschrieben
- Nützlich für regelmäßige Bestandsabgleiche ohne Verlust manueller Lieferanten-Zuordnungen

### Feature: MySQL-Port für SSH-Tunnel-Zugriff

- MySQL-Port wird auf Host-Loopback (127.0.0.1:3306) exponiert – direkter DB-Zugriff per SSH-Tunnel möglich

### Bugfix

- Schnellbuchung: Nach Löschen eines Artikels über den Mülleimer-Button springt der Cursor sofort zurück ins Barcode-Feld
- Wareneingang: Event-Objekt als Argument überschrieb die Lieferscheinnummer – Button-Handler korrigiert
- DB-Stats: `table_name`-Alias explizit gesetzt (information_schema liefert UPPERCASE-Spaltennamen)
- DB-Stats: Doppelte Destrukturierung `[[{db}]]` auf `[{db}]` korrigiert
- Hyreka: Buchungen aus der Bewegungshistorie ausgeblendet (erschienen als normale CHECK_IN-Buchungen)
- PDF-Archiv: Inline-Anzeige im Archiv korrigiert
- Lager-Isolation: Verbrauchstrend filtert jetzt korrekt nach Lager
- Backup-Gate: Backup-Prüfung greift jetzt vor jedem Update zuverlässig
- Bestellvorschläge: Artikel ohne Lagerort (`locationId=NULL`) zeigen jetzt korrekt den Bestand
- Dashboard: KPI „Unter Sollbestand" entfernt (war redundant / veraltet)
- Repair-Migration: Nur Bewegungen mit gültiger Location werden verarbeitet

---

## [3.7.0] – 2026-05-11

### Feature: Lieferanten-Zuweisung pro Lager

- Manager können Lieferanten einem bestimmten Lager zuweisen (Teilelager / Tonerlager)
- WAREHOUSE-User sehen nur noch Lieferanten ihres eigenen Lagers (strikte Isolation, inkl. 3-Ebenen-Hierarchie)
- Super-Admin sieht in der Lieferanten-Tabelle ein Lager-Chip und ein Lager-Dropdown mit Niederlassungsname

### Feature: Niederlassungsname im Lager-Dropdown (Super-Admin)

- Lager-Dropdown zeigt jetzt `Lagername (Niederlassung)` statt nur den Lagernamen
- Betrifft: Lieferanten-Formular, Bestellvorschläge, überall wo Super-Admin Lager wählt

### Feature: Einzelnes Lager zurücksetzen (Wartungsseite)

- Super-Admin kann ein einzelnes Lager mit allen zugehörigen Daten löschen
- Vorschau zeigt betroffene Artikel, Lieferanten, Lagerorte und Buchungen
- Löscht in korrekter Reihenfolge: Bestellzeilen → Artikelcodes → Artikel (inkl. Buchungen per Cascade) → Lieferanten → Lagerorte

### Feature: Letzte Bestellung im Artikel-Dialog

- Artikelstamm zeigt jetzt im Edit-Dialog die letzte Bestellung: Datum, Bestellnummer, Menge, Lieferant
- Auch in der eigenständigen `ItemEditDialog`-Komponente verfügbar

### Performance & Skalierung

- **N+1-Queries behoben:** Bestellerstellung, Wareneingang, Bulk-Update, `listOrderDocuments`, `resolveWarehouseDescendants`
- **Transaktionen:** `receiveOrder()` und `normalizeVehicleStockLevels()` sind jetzt atomar – kein inkonsistenter Zustand bei Fehler
- **Race Condition Bestellnummern:** `generateOrderNumber()` nutzt `SELECT FOR UPDATE` (keine doppelten Bestellnummern unter Last)
- **Restock-Sync** wird nur noch 1× pro 30 Sekunden ausgelöst (fire-and-forget, blockiert die API nicht mehr)
- **HTTP-Kompression** (gzip) aktiviert – 60–80 % weniger Transfervolumen für JSON-Antworten
- **PapaParse** wird jetzt dynamisch geladen – nicht mehr im initialen Bundle (~45 KB gespart)
- **5 neue DB-Migrationen** mit Performance-Indizes auf `stock_movements`, `stock_levels` und `items`
- `resolveWarehouseDescendants` nutzt rekursives SQL-CTE statt N+1-Schleife
- Restock-Übersicht lädt Lines nicht mehr beim Session-Listing (nur noch beim Einzelaufruf)
- `updateBulk` (Hyreka-Import) läuft jetzt parallel in Batches von 10 (statt seriell)

### Sicherheit

- **10 Security-Härtungen** (Rate-Limiting, CSP-Header, Input-Validierung, Login-Throttle, ...)
- **Eager → Lazy Loading** für alle TypeORM-Entitäten (reduziert unbeabsichtigtes Datenleck)
- `getOrderDocument()` prüft Branch-Zugehörigkeit jetzt per direktem `findOne` statt alle Bestellungen zu laden
- Globaler Rate-Limiting-Guard aktiv (300 Req/min pro IP, Login 10/15 Min)

### Bugfixes

- Bestellvorschläge: `onSaved`-Callback übergibt jetzt den Warehouse-Filter (Filter blieb vorher verloren)
- Bestellvorschläge: Artikel ohne zugewiesene `storageLocation` erscheinen nicht mehr in ungefilterter Ansicht
- Offline-Queue: ServiceWorker-Sync wartet auf MessageChannel-Bestätigung (kein falsches `isSyncing: false` mehr)
- Offline-Queue: Fehlgeschlagene Item-Syncs bleiben in der Queue + Fehlermeldung wird angezeigt
- Doppelbuchungs-Race-Condition im Offline-Queue vollständig behoben
- `repairDuplicateStockLevels` / `diagnoseStockLevels` nutzen jetzt Branch-Filter (kein Full-Table-Scan mehr)
- Nutzloser `try/catch` in `recordLine()` entfernt
- Migration bereinigt vorhandene doppelte StockLevel-Einträge (item + vehicle)

---

## [3.6.5] – 2026-04-28

### Diverse Fixes & Verbesserungen (Schnellbuchung, Kamera, Inventur, Lager-Isolation)

- Schnellbuchung: Kamera-Fix, Vorgangsnummer-Scan stabile Kamera via Ref-Pattern, Echtzeit-Sync
- Inventur: Fahrzeug-Inventur mit vehicleId nullable, Lager-Buchung aus Artikel-Lagerort ableiten
- Lager-Isolation: Vollständige Branch-Isolation in allen Modulen, 3-Ebenen-Hierarchie
- Super-Admin kann finalisierte Inventuren manuell löschen
- Inventur-Benutzerzuweisung (Mehrfach), Bewegungshistorie Pagination und Serverfilter
- Protokollarchiv: tägliche Archivierung, Suche, Live-Modus, Archiv-Löschen (Super-Admin)
- DB-Optimierungen für 200K Artikel / 200 gleichzeitige Nutzer

---

## [3.6.4] – 2026-04-27

### Feature: Schnellzugriff-Buttons im Header

- Konfigurierbare Buttons erscheinen jetzt oben im Header (neben „Lagerverwaltung") – auf jeder Seite sichtbar
- Getrennte Konfiguration für **PC/Desktop** (Icon + Beschriftung) und **Mobil/Tablet** (nur Icon)
- Pro Benutzer und Gerät konfigurierbar: Zielseite, Bezeichnung, Farbe
- Konfiguration über „Dashboard anpassen" → Tab „PC / Desktop" oder „Mobil / Tablet"
- Das bestehende Dashboard-Schnellzugriff-Widget bleibt erhalten und zeigt weiterhin die Desktop-Buttons

---

## [3.6.3] – 2026-04-27

### Refactor: Benutzereinstellungen in der Datenbank gespeichert

Alle benutzerspezifischen Einstellungen werden jetzt serverseitig im vorhandenen
`/users/me/settings`-Endpunkt gespeichert und sind damit auf allen Geräten synchron.

**Migrierte Einstellungen:**
- **Schnellbuchung-Workflow** (Vorgangsnummer zuerst / direkt Barcode) – war gerätespezifisch in localStorage
- **Theme-Modus** (hell / dunkel) – war gerätespezifisch in localStorage
- **Theme-Preset** (Farbschema) – war gerätespezifisch in localStorage

**Verhalten:**
- Beim Login wird das Theme automatisch aus den DB-Settings angewendet
- Änderungen werden sofort gespeichert und gelten auf allen Geräten
- Offline-Fallback: localStorage bleibt als Cache erhalten

**Nicht migriert (bewusst gerätespezifisch belassen):**
- Kamera-Auswahl (Barcode-Scanner) – gerätespezifisches Peripheriegerät
- Offline-Buchungsqueue, Offline-Inventur – ephemere Gerätedaten
- Dashboard-Cache – Offline-Cache, kein Setting

---

## [3.6.2] – 2026-04-27

### Feature: Schnellbuchung – konfigurierbarer Startfokus

- Neuer Toggle „Workflow" direkt im Schnellbuchungs-Formular
- **EIN (Vorgangsnummer → Artikel):** Fokus landet beim Öffnen und nach Übernehmen auf dem Vorgangsnummer-Feld (z.B. Tonerlager)
- **AUS (Direkt Artikel):** Fokus landet beim Öffnen und nach Übernehmen direkt auf dem Barcode-Feld (z.B. Teilelager)
- Einstellung wird pro Gerät in `localStorage` gespeichert und bleibt nach Browser-Neustart erhalten

### Feature: Inventur – Mehrfachzuweisung an Benutzer

- Manager können beim Erstellen einer Inventursitzung mehrere Benutzer zuweisen (war bisher max. einer)
- Nicht-Manager sehen nur Sitzungen ohne Zuweisung oder Sitzungen, in denen sie selbst enthalten sind
- DB-Spalte von `assignedUserId` (char) auf `assignedUserIds` (JSON-Array) migriert

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
