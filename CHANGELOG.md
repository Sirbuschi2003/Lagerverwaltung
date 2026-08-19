# Changelog

Alle nennenswerten Änderungen, neueste zuerst.

---

## [19.08.2026]

### Behoben
- **401-Burst nach Tab-Sleep** (`2d73fe2`) — `visibilitychange`-Listener ruft Token-Refresh proaktiv auf wenn Tab wieder sichtbar wird; verhindert den Burst paralleler 401-Fehler nach Chrome-Tab-Throttling
- **userId=NULL in Lagerbewegungen** (`2d73fe2`) — `recordMovement` und `syncMovements` verwenden `req.user.id` als Fallback wenn DTO keine userId enthält
- **Alternative Codes beim Wareneingang-Scan** (`0e196bf`) — `purchasing.service.ts` joined `item.codes` Relation; Artikel werden jetzt auch über Alternativcodes gefunden
- **DB-Fehler: system_logs.category ENUM** (`6f09264`) — Migration ergänzt `PURCHASE` und `EMAIL`; vorher: `Data truncated for column 'category'` beim Bestellstatus-Logging

### Neu
- **Wareneingang: Draft-Persistenz** (`05171d7`) — vorgemerkte Positionen in `sessionStorage` gespeichert; bei Tab-Wechsel/Navigation bleibt der Stand erhalten; Chip „Vorgemerkt" in der Bestellungsliste; nach erfolgreichem Buchen automatisch gelöscht
- **Wareneingang: CONFIRM-QR-Code** (`05171d7`) — Scan des Werts `CONFIRM` bestätigt den aktiven Scan-Treffer (= „OK übernehmen"); gilt nicht für „Wareneingang buchen"
- **Wareneingang: CONFIRM-QR drucken** (`4205b32`) — Druck-Button im Dialog erzeugt A6-Ausdruck mit QR-Code, analog zu Schnellbuchungs-Aktionscodes

---

## [13.08.2026]

### Neu
- **Systemprotokoll: Archiv-UI** (`378286b`) — Logs werden archiviert statt gelöscht; Archiv-Viewer im Frontend
- **Getrennte Aufbewahrungszeiten** (`048e9a8`) — aktive Logs und Archiv haben separate Retention-Policies

---

## [12.08.2026] – v4.2

### Behoben
- **F5/Offline-Logout-Loop** (`483f195`) — Token-Rotation deaktiviert; verhindert Abmeldung durch veraltetes Refresh-Cookie nach Hard-Refresh
- **RefreshToken Datenbankfehler** (`8f52056`, `2856713`) — expliziter `datetime`-Typ für `revokedAt`; ER_DUP_ENTRY bei Doppel-Login abgefangen
- **JWT-Fallback-Defaults** (`076681e`) — `docker-compose`-Defaults auf 8h/90d korrigiert (statt 15m/7d)
- **Security-Audit** (`33cabfc`) — SEC-001/002, DOCKER-ROOT, CSP, DSGVO, Accessibility
- **dayjs entfernt** (`62343f1`) — vollständig auf `date-fns` migriert

---

## [11.08.2026] – v4.1.0 / v4.1.1

### Behoben
- **ZIP-Backup (archiver)** (`7d043eb`) — archiver durch adm-zip ersetzt; kein ESM-Kompatibilitätsproblem mehr
- **Security & Race Conditions** (`e124fce`) — Vollaudit 72 Findings; kritische Bugfixes in Buchung, Auth, CORS
- **Password-Reset** (`8495cb8`) — Parameterreihenfolge; MySQL localhost-Binding; JWT-Laufzeiten

---

## [07.08.2026] – v4.0.0 / v4.0.1–4.0.7

### Neu
- **Produktivbetrieb-Release v4.0.0** (`9383e3a`) — stabile Version für den Echtbetrieb
- **QR-Aktionscodes Schnellbuchung** (`1fb2dee`) — `QB:CONFIRM` (Buchung übernehmen) und `QB:RESET` (Vorgangsnummer zurücksetzen) per QR druckbar
- **ZIP-Archiv-Backup vollständig** (`05f9d4c`) — Bilder + Bestellungs-PDFs im ZIP; Wiederherstellung (`690339c`)
- **Backup: Artikelbilder** (`c3a9c0f`), **user_locations** (`c23a3a3`), **Anzahl-Limit** (`bf58751`)
- **Bestellpositionen-Detail** (`ba873a4`) — aufklappbare Zeilen im Offen-Tab
- **Dev-Umgebung Windows** (`9cdca80`) — `start-dev.bat`, `.env.dev`, CORS-Fix für localhost

### Behoben
- Migrationen laufen jetzt vor NestJS-App-Start (`4b879bb`)
- LoginPage leitet zu `/setup` wenn kein Benutzer existiert (`7a125e5`)
- Backup lädt Lieferanten-Relation für Bestellungen (`51cdaaf`)

---

## [08.07.2026] – v3.9.1

### Neu
- **Fahrzeug-Scanner: Ein-/Ausbuchen-Modus** (`4ec475f`) — Umschalter zwischen CHECKIN und CHECKOUT direkt im Scanner

### Behoben
- Bestellungs-PDF mehrseitig (`2c20973`) — Tabellenkopf + Fußzeile auf allen Seiten

---

## [22.06.2026]

### Neu
- **Lieferschein-Historie im Wareneingang** (`41b69bc`) — bisherige Lieferscheinnummern mit Datum unterhalb des Eingabefelds angezeigt

---

## [18.06.2026]

### Behoben
- Duplikat-Warnung Schnellbuchung als Snackbar — wirklich nicht-blockierend (`0c92ecd`)
- Offline-Fehler bei Techniker außerhalb Firmennetz (`4642d1d`)

---

## [04.06.2026]

### Neu
- **MySQL SQL-Dump** (`0143038`) — Datenbankexport als `.sql`-Datei über die Backup-Seite

### Behoben
- Bestand in Verbrauchsprognose zählte Fahrzeug- und Fremdniederlassungs-Bestand (`b8ae182`)
- Geister-StockLevels (vehicleId=null AND locationId=null) aus Report-Bestand ausgeschlossen (`26dab6d`)
- Report-Bestand zählt nur noch primären Lagerort (`9c8976b`)

---

## [01.06.2026] – v3.9.0

### Neu
- **Lieferschein-Zuordnung per Ordner-Watcher** (`d931070`) — PDFs automatisch Bestellungen zugeordnet; PDF-Viewer in Bewegungshistorie

---

## [28.05.2026]

### Neu
- **Tab-Leiste (Keep-Alive)** (`c0fabe9`) — geöffnete Seiten bleiben im Speicher; Tabs schnell wechselbar
- **Artikel-Bilder Lightbox + Kamera-Upload** (`092be91`) — Kamera direkt im Artikeldialog; Bilder in Fahrzeugkarten (Mobil)

---

## [22.05.2026] – v3.8.0

### Neu
- **Verbrauchsprognose** (`70a5ef7`) — in Berichte & Analysen (7/30/60/90/180/365 Tage)
- **Reichweiten-Prognose** (`7a6608b`) — in Bestellvorschlägen (Tage bis Leerstand)
- Fahrzeugbuchungen aus Berichten/Historie standardmäßig ausgeblendet (`c845311`)

---

## [11.05.2026] – v3.7.0

### Optimierungen
- **N+1 Queries** beseitigt, Transaktionen, Kompression (`52f84c0`)
- Neue DB-Indizes für stock_movements, Dashboard-Fullscan durch SQL-Aggregation ersetzt

### Neu
- **Hyreka-Abgleich-Modus** (`f6bdf20`) — Lieferanten beim Import beibehalten
- Pre-Migration-Backup vor jedem Datenbankupdate (`1d19fd7`)
- Bestell-PDF Designer-Layout anhand Niederlassungs-Template (`8e66103`)

### Behoben
- OfflineQueue Race Condition (`52f84c0`)
- Bestand=0 Bug (Repair-Migration) (`9211857`)

---

## [27.04.2026] – v3.6.1

### Neu
- **Inventur: Mehrfachzuweisung** (`30ba5a0`) — mehrere Benutzer einer Inventur-Session zuweisbar
- **Schnellbuchung: konfigurierbarer Workflow-Toggle** (`80a9c21`) — Startfokus (Vorgangsnummer vs. Barcode) pro Benutzer gespeichert
- Schnellzugriff-Buttons im Header (PC & Mobil)

### Behoben
- Dashboard zeigt Buchungen aller Techniker (nicht nur eigene)
- Offene Anforderungen: Lager-Trennung Teilelager/Tonerlager
- Bestellwizard: Artikelsuche + Mehrfach-Hinzufügen stabilisiert
- PDF-Dateiname = Bestellnummer (nicht UUID)
- Kamera-Scanner: Video-Element immer im DOM

---

## [24.04.2026]

### Neu
- **Bewegungshistorie Pagination** (`f3caabc`) — serverseitige Pagination, Quelle/Vorgangsnummer als Serverfilter
- **Inventur: Einzelbenutzerzuweisung** (`3cea23a`)
- Schnellbuchung: Artikel-Freitextsuche im Barcode-Feld

---

## [21.04.2026] – v3.6.0

### Neu
- **Lager-Trennung in Berichten & Bewegungshistorie** (`c00643a`)
- **Schnellbuchung: verfügbarer Bestand** (`7f189a5`) — angezeigt in Artikel-Info und Buchungsliste

### Behoben
- CSV-Import erkennt `Produktgruppe`-Spalte; Warengruppen-Fallback-Fehler

---

## [17.04.2026] – v3.5.1

### Behoben (10 Fixes)
- Backup-Restore: PayloadTooLarge, Timeout, fehlende Felder, branchId, StockLevel ID-Mapping
- Schnellbuchung CHECKIN ohne Lagerort buchte lautlos in Leere
- Hyreka-Import: Lagerort-Fallback, Mindestbestand-Mapping
- Rate-Limit für Bulk-Importe: 100 → 500/min

### Neu
- Selektive Backup-Wiederherstellung (granulare Filter)
- Filter „Ohne Lagerort" in Artikelliste (Manager)

---

## [15.04.2026] – v3.4.1–v3.5.0

### Neu
- **Lager-Zugriffssteuerung** (`4e571e2`) — Zugriff über `user_locations` statt Branch-weit
- Lager-basierte Filterung: Dashboard, Sollbestand, Bestellvorschläge, Bewegungshistorie, Lieferanten
- Lager-Filter auf Bestellungs-Ablagestruktur
- Einzelnes Lager zurücksetzen (`3068ed7`)

### Behoben
- JWT beim App-Start refreshen damit locationIds-Filter greift
- Import-Lagerort-Kollision zwischen gleichnamigen Regalen verschiedener Lager

---

## [14.04.2026] – v3.4.0

### Neu
- **Mehrere Lager (Warehouses) pro Niederlassung** (`8ee1756`) — vollständige Lager-Trennung innerhalb einer NL

---

## [10.04.2026] – v3.3.9

### Neu
- **Berichte & Analysen** (`fbf1f2f`) — erweiterte Filter, Artikel-Verbrauchstrend
- Lieferschein-Zuordnung (frühe Version)

---

## [08.04.2026] – v3.3.5–v3.3.8

### Behoben / Sicherheit (v3.3.5)
- Magic-Bytes-Prüfung für Uploads (ohne `file-type` Package)
- CORS: same-origin Requests und APP_HOST automatisch erlaubt
- Inventur-Fix; Logs nur für Super-Admin

### Neu (v3.3.7)
- Bestellungen: Firmendaten im PDF; Ordnerstruktur; Bestellnummer-Format

### Neu (v3.3.8)
- **Archivierte Bestellungen löschen** (`9d29b48`) — mit Berechtigung `orders.delete`
- Niederlassung in Bestelllisten für Super-Admin

---

## [07.04.2026] – v3.3.1–v3.3.4

### Behoben
- Vollständige Artikel-Isolation pro Niederlassung (`e8d8655`)
- Super-Admin kann Benutzer Niederlassungen zuweisen (`00f3115`)
- Lagerorte-Codes per Niederlassung isoliert
- Migrations-Idempotenz (Duplikate, FK-Constraints)

---

## [02.04.2026] – v3.3.0

### Neu
- **Niederlassungsspezifische Einstellungen** (`8fd761a`) — Firmendaten, E-Mail, Lager je NL konfigurierbar
- Cross-Branch-Verfügbarkeit in Bestellvorschlägen (v3.1.0)
- Vollständige NL-Isolation aller Endpunkte (v3.2.0)

---

## [01.04.2026] – v3.0.0

### Neu (Major Release)
- **Multi-Branch Architektur** (`4359b54`) — vollständige Datenisolation zwischen Niederlassungen
- Super-Admin-Rolle: mandantenübergreifende Verwaltung
- Branch-Configs: per-Niederlassung konfigurierbar

### Behoben
- SUPER_ADMIN-Fix + Niederlassung in User-Verwaltung (v3.0.1)

---

## [01.04.2026] – v2.2.7–v2.2.13

### Behoben
- Fehlmenge-Berechnung in Unter-Sollbestand-Liste
- Fehlmenge-Basis: Mindestbestand nur Filter, nicht Berechnungsgrundlage
- Schnellbuchung: Dauerscan-Modus

### Neu
- Wareneingang User-Tracking (`87d7031`)
- Kamera-Scanner in Schnellbuchung überarbeitet: Duplikat-Sperre bis Kamera wegbewegt
- Mobile Buchungsliste als Karten-Ansicht

---

## [31.03.2026] – v2.2.0–v2.2.6

### Neu
- **Artikelbilder** (`cf23576`) — Upload bis 25 MB, Anzeige im Artikeldialog
- **Dashboard** (`14b1470`) — ausstehende Offline-Buchungen im Letzte-Buchungen-Widget
- **Kamera-Scanner** (`49d2c97`) — in der Schnellbuchung eingebaut
- Dashboard rollenbasiert gefiltert (v2.2.6)
- Update-Mechanismus komplett überarbeitet (v2.2.2)
- Stabiles selbst-signiertes TLS-Zertifikat (v2.2.3)

### Behoben
- Offline Pull-to-Refresh + Update-Diagnose

---

## [30.03.2026] – v1.0 / v2.1.x

### Neu
- **Initial Release** (`68a3e57`) — KFZ Lagerverwaltung: Lagerhaltung, Schnellbuchung, Bestellungen, Fahrzeugbestand
- Updatefunktion eingebaut (`51a1aa6`)
- Wartungsseite (`93a6982`)
- Docker-Deployment + GHCR CI

### Behoben (v2.1.1–v2.1.5)
- Update-Funktion Bugs und Anpassungen

---
