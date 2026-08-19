# Changelog

Alle nennenswerten Änderungen werden hier dokumentiert.  
Format: `[Datum] – Kategorie – Beschreibung (Commit)`

---

## [19.08.2026]

### Behoben
- **401-Burst nach Tab-Sleep** (`2d73fe2`)  
  Frontend-App registriert jetzt einen `visibilitychange`-Listener, der das Access-Token proaktiv refresht wenn ein Browser-Tab wieder sichtbar wird. Verhindert den bekannten Burst paralleler 401-Fehler nach Chrome-Tab-Throttling.

- **userId=NULL in Lagerbewegungen** (`2d73fe2`)  
  `recordMovement` und `syncMovements` im StockController verwenden jetzt `req.user.id` aus dem JWT als Fallback, wenn das DTO keine userId enthält. Betraf Offline-Queue-Buchungen nach Token-Refresh.

- **Alternative Artikelcodes beim Wareneingang-Scan** (`0e196bf`)  
  `purchasing.service.ts` joined die `item.codes`-Relation in `findAll` und `findOne`. Artikel werden beim Wareneingang-Scan jetzt auch über ihre Alternativcodes gefunden.

- **DB-Fehler: system_logs.category ENUM unvollständig** (`6f09264`)  
  Migration `1755300000000` erweitert die MySQL-ENUM-Spalte `category` in `system_logs` um `PURCHASE` und `EMAIL`. Vorher: `Data truncated for column 'category'` beim Loggen von Bestellstatus-Wechseln.

### Neu
- **Wareneingang: Draft-Persistenz** (`05171d7`)  
  Vorgemerkte Positionen (nach „OK übernehmen", aber vor „Wareneingang buchen") werden im `sessionStorage` gespeichert (Key: `goodsReceipt_draft_{orderId}`). Bei Tab-Wechsel oder App-Navigation bleibt der Stand erhalten. Beim Zurückkehren erscheint ein gelbes Banner; in der Bestellungsliste zeigt ein Chip „Vorgemerkt". Der Entwurf wird nach erfolgreichem Buchen automatisch gelöscht.

- **Wareneingang: CONFIRM-QR-Code** (`05171d7`)  
  Scan des QR-Code-Werts `CONFIRM` bestätigt den aktiven Scan-Treffer direkt (entspricht „OK übernehmen"). Betrifft nur die Positions-Bestätigung — nicht die Gesamtbuchung.

- **Wareneingang: CONFIRM-QR drucken** (`4205b32`)  
  Button „CONFIRM-QR" (Drucker-Symbol) im Wareneingang-Dialog öffnet einen QR-Code-Dialog. Klick auf „Drucken" erzeugt einen A6-Ausdruck mit QR-Code und Beschriftung — analog zum Schnellbuchungs-Aktionscode.

---

## [12.08.2026]

### Behoben
- **F5/Offline-Logout-Loop** (`483f195`)  
  Token-Rotation auf dem Backend deaktiviert. Beim Hard-Refresh (F5) oder Offline-Betrieb wurden Refresh-Tokens nach dem ersten Refresh invalidiert, was eine sofortige Abmeldung auslöste.

---

## [11.08.2026]

### Behoben
- **Backup schlägt fehl (adm-zip)** — ZIP-Erstellung mit adm-zip gefixt
- **Toshiba Supplier DB-Constraint** — Toshiba-Lieferant konnte nicht gespeichert werden

### Analysen
- Vollaudit 72 Findings: Security 4/10, Qualität 6/10, Compliance 5/10

---

## [10.08.2026]

### Neu
- ZIP-Restore: Backups können als ZIP wiederhergestellt werden
- Code-Review: 29 Findings identifiziert und priorisiert

### Behoben
- archiver-Bibliothek: ZIP-Erstellung für Backups repariert

---

## [08.07.2026]

### Neu
- **Fahrzeug-Scanner: Ein-/Ausbuchen-Modus** (`4ec475f`, v3.9.1)  
  Umschaltbar zwischen Einbuchen (CHECKIN) und Ausbuchen (CHECKOUT) direkt im Scanner.

---

## [03.07.2026]

### Behoben
- **Bestellungs-PDF mehrseitig** (`2c20973`)  
  Lange Bestellungen mit vielen Positionen wurden auf einer Seite gequetscht. Jetzt korrekte Seitenumbrüche.

---

## [04.06.2026]

### Behoben
- Bestand-Doppelzählung in Reports

### Neu
- MySQL-Dump: Datenbankexport als SQL-Datei aus der UI heraus

---

## [22.05.2026]

### Neu
- Fahrzeugbuchungen-Filter in Berichte/Historie
- Reichweiten-Prognose in Bestellvorschlägen (Verbrauchsdaten → Tage bis Leerstand)

---

## [11.05.2026]

### Behoben
- Bestand=0 Bug (Repair-Modus)
- OfflineQueue Race Condition

### Optimierungen
- N+1 Queries beseitigt, Transaktionen, Indizes, HTTP-Kompression

### Neu
- Hyreka Abgleich-Modus

---

## [07.05.2026]

### Neu
- Lieferanten-Isolation pro Niederlassung
- PDF-Viewer für Lieferscheine in der Bewegungshistorie
- Letzte-Bestellung-Anzeige je Artikel

### Optimierungen
- 10 Security- und Performance-Härtungen
- Eager→Lazy Relations, stock_movements-Indizes

---

## [05.05.2026]

### Neu
- LogsPage: Systemlogs im Frontend aufrufbar

### Behoben
- 6 Bugfixes (DB-Optimierungen, UI)

---

## [28.04.2026]

### Neu
- Lager-Isolation für alle Module
- Schnellbuchung: Vorgangsnummer via QR-Code scannen

### Behoben
- Inventur-Tonerlager-Fix

---

## [02.04.2026]

### Neu (v3.3.0)
- Branch-Isolation: Niederlassungen vollständig voneinander getrennt
- Super-Admin: mandantenübergreifende Verwaltung
- Per-Branch SMTP-Konfiguration
- branch_configs Tabelle

---
