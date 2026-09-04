# Changelog

Alle nennenswerten Änderungen werden in dieser Datei dokumentiert.  
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

---

## [4.3.0] – 2026-09-04 · Security & Compliance Release

> **Wichtig:** Dieses Release behebt kritische Sicherheits- und Compliance-Findings aus dem Vollaudit vom 04.09.2026 (22 Agenten, 98 Findings). Alle 10 KRITISCH-Findings und die wichtigsten HOCH-Findings wurden adressiert.  
> **Pflicht vor dem Produktiveinsatz:** `.env` um `DEFAULT_ADMIN_PASSWORD` und `DB_POOL_SIZE` ergänzen (siehe Installationsanleitung).

### Security
- **NIS2-003 – Klartext-Secrets entfernt:** Alle Fallback-Secrets (`JWT_SECRET=super-secret`, `MYSQL_ROOT_PASSWORD=changeMeRoot` usw.) aus `docker-compose.yml` entfernt. Das System startet ohne korrekt befüllte `.env` nicht mehr.
- **NIS2-002 – Docker-Socket abgesichert:** Der Backend-Container mountet `/var/run/docker.sock` nicht mehr direkt. Stattdessen läuft ein `socket-proxy`-Container (Tecnativa docker-socket-proxy 0.3.0) als Mittelsmann mit minimalen Rechten (nur `CONTAINERS` + `IMAGES` + `POST`). Host-Escape ist damit nicht mehr möglich.
- **NIS2-005 – Port-Binding:** Backend-Port 3000 und Frontend-Port 80 in `docker-compose.yml` (Entwicklung) nur noch an `127.0.0.1` gebunden.
- **SEC-001 – Refresh-Token-Invalidierung:** Nach `changePassword()` und `resetPassword()` werden alle aktiven Refresh-Tokens des Benutzers sofort widerrufen. Gestohlene Tokens werden damit innerhalb von Sekunden ungültig.
- **SEC-002 – Password-Reset-Token gehashт:** Reset-Tokens werden nur noch als SHA-256-Hash in der Datenbank gespeichert (identisch mit der bestehenden Refresh-Token-Logik). Der Klartext-Token geht ausschließlich per E-Mail an den Benutzer.
- **SEC-012 – Passwort-Mindestlänge:** Von 8 auf 12 Zeichen erhöht (OWASP-Empfehlung).
- **JWT-Laufzeit:** Access-Token-Laufzeit von 24 Stunden auf 15 Minuten gesenkt (OWASP). Bestehende Sitzungen laufen durch den Refresh-Token-Flow weiterhin nahtlos.
- **Erweiterter Schwachstellen-Check:** `INSECURE_JWT_SECRETS`-Set um `super-secret`, `changeme123` und `lagerverwaltung` erweitert. Schwache Secrets werden beim Start erkannt und führen zum Abbruch.

### DSGVO / Datenschutz
- **DSGVO-003 – IP-Anonymisierung:** IP-Adressen in `password_reset_tokens` werden auf Subnetz-Ebene anonymisiert gespeichert (IPv4: letzes Oktett → 0, IPv6: ab Gruppe 4 → `*`).
- **DSGVO-001 – Recht auf Vergessenwerden (Art. 17):** Neuer Endpunkt `POST /users/:id/anonymize`. Benutzer können sich selbst anonymisieren; Super-Admins können beliebige Konten anonymisieren. Der Endpunkt ruft die bestehende `anonymizeUser()`-Methode auf und erstellt einen Audit-Log-Eintrag.
- **DSGVO-020 – Datenportabilität (Art. 20):** Neuer Endpunkt `GET /users/me/export`. Gibt alle eigenen Benutzerdaten als JSON-Download zurück (`Content-Disposition: attachment`).
- **DSGVO-006 – Token-Bereinigung:** Neuer `AuthCleanupService` mit täglichem Cron-Job (03:00 Uhr). Löscht abgelaufene Refresh-Tokens sowie verwendete oder abgelaufene Password-Reset-Tokens, die älter als 7 Tage sind.

### GoBD / Compliance
- **GOB-001 – Löschsperre Bestellungen:** `purgeOldOrders()` ist deaktiviert. Abgeschlossene Bestellungen dürfen nach GoBD Rn. 64–67 nicht physisch gelöscht werden (Aufbewahrungspflicht §257 HGB: 10 Jahre). Die Methode schreibt nur noch eine Warnung ins Log.
- **GOB-002 – Löschsperre Bestellungs-PDFs:** `deleteOrderPdfFromStorage()` ist deaktiviert (§257 HGB Belegpflicht). Fehler in `saveOrderPdfToStorage()` werden geloggt und nach oben propagiert.
- **GOB-004 – Log-Archiv-Mindestretention:** `cleanupOldArchives()` erzwingt eine Mindest-Retention von 3650 Tagen (10 Jahre, §147 AO). Konfigurationswerte unterhalb dieser Grenze werden auf das Minimum angehoben.
- **GOB-007 – PDF-Pflichtfelder:** `stripOrderPdfFields()` ist deaktiviert. Preisfelder werden nicht mehr aus Bestelldokumenten entfernt (§14 UStG: Pflichtangaben auf Rechnungen/Belegen).

### NIS2 / Audit-Trail
- **NIS2-001 – deleteAllLogs() abgesichert:** Die Methode schreibt vor der Löschoperation einen `SECURITY`-Level-Eintrag in die Log-Tabelle. Dieser SECURITY-Eintrag überlebt die Löschung und dokumentiert, wer wann alle Logs gelöscht hat. SECURITY-Logs werden grundsätzlich nicht durch `deleteAllLogs()` entfernt.

### Skalierbarkeit
- **SCALE-01 – Connection-Pool:** Standard-Pool-Size von 30 auf 80 erhöht (ausreichend für 200 gleichzeitige Techniker). Konfigurierbar über `DB_POOL_SIZE` in der `.env`.
- **SCALE-02 – Docker Resource Limits:** Backend (2 CPUs, 1,5 GB RAM) und MySQL (4 CPUs, 2 GB RAM) haben in `docker-compose.main.yml` definierte Ressourcenlimits.

### Transaktionssicherheit
- **TX-01 – applyMovementToStock:** Die Methode nimmt jetzt einen optionalen `EntityManager` entgegen und führt Bestand-Updates innerhalb der übergebenen Transaktion aus. Kein partieller Bestandsfehler mehr bei Schreibfehler.
- **TX-02 – reorderLines:** `Promise.all()` für Position-Sortierung in einer gemeinsamen `dataSource.transaction()` gewrappt.
- **TX-03 – removeVehicleStock:** `linesRepository.remove()` und `stockLevelsRepository.remove()` laufen jetzt in einer gemeinsamen Transaktion. Kein halbgeleerer Fahrzeugbestand bei Datenbankfehler.

### MFA
- **MFA opt-in:** MFA bleibt freiwillig für alle Rollen. Admins können TOTP-MFA über `POST /auth/mfa/setup` → `POST /auth/mfa/verify-setup` aktivieren.
- **MFA-Bootstrap-Flow:** Neue Endpunkte für den Fall dass ein Administrator MFA einrichten möchte ohne bereits eingeloggt zu sein:
  - `POST /auth/mfa/setup-init` – QR-Code anfordern via kurzlebigem `mfaSetupToken` (10 Minuten)
  - `POST /auth/mfa/verify-setup-init` – TOTP bestätigen + vollständige Auth-Tokens erhalten

### Infrastruktur
- **socket-proxy Container:** Neuer `socket-proxy`-Service in `docker-compose.main.yml` (startet vor dem Backend, `depends_on`).
- **DEFAULT_ADMIN_PASSWORD:** In Production wird beim Fehlen dieser Umgebungsvariable ein Fehler geworfen statt einen unsicheren Standardwert zu verwenden.
- **TypeORM-Migration `1755600000000-SecurityHardeningFixes`:** Bereinigt abgelaufene Password-Reset-Tokens und legt einen Index auf `password_reset_tokens.token` an.

---

## [4.2.0] – 2026-08-28

### Neu
- **Techniker-Artikelansicht (read-only):** Öffnet ein Techniker den Artikelstamm, sind alle Lagerfelder (Lagerort, Preise, Soll-/Melde-/Mindestbestand, Ist-Bestand) ausgeblendet. Angezeigt wird stattdessen:
  - **Im Fahrzeug** – eigener Fahrzeugbestand für diesen Artikel (read-only)
  - **Im Teilelager** – aktueller Lagerbestand (read-only, nur Ansicht)
  - **QR-Code und Weitere Codes** – editierbar (Techniker können fahrzeugspezifische Codes hinterlegen und speichern)
  - Alle sonstigen Felder (Bezeichnung, Hersteller etc.) sind schreibgeschützt; kein versehentliches Überschreiben von Stammdaten.
- **Bestand prüfen (Fahrzeug-Scanner):** Neuer Scan-Modus „Bestand prüfen" im Modus-Umschalter auf der Seite „Mein Fahrzeug". Scanner → Artikel scannen → Fahrzeugbestand wird sofort als Dialog angezeigt (grün ≥ 1, rot = 0), ohne Buchung auszulösen.
- **Farbschema-Persistenz:** Neue Farbschemata (Atlantik, Dämmerung, Bernstein, Himmelblau) werden nach Seiten-Reload korrekt wiederhergestellt (dynamische Preset-Validierung statt hartcodierter Liste).

### Behoben
- **Bestandsanzeige Bestellvorschläge (Artikel 6B000001169):** 412 Waisendatensätze in `stock_levels` (locationId = NULL, entstanden durch Migration vom 15.06.2026) setzten den berechneten Ist-Bestand künstlich auf 1. Bereinigt per direktem DB-UPDATE; Bestellmenge wird jetzt korrekt berechnet.

---

## [4.1.1] – 2026-08-21

### Behoben
- **Dashboard-Persistenz (F-08-FE / SEC-009):** Benutzer-Einstellungen (Dashboard-Widgets, Schnellzugriff-Buttons, Theme, Farben u.a.) wurden beim Reload oder erneutem Login nicht korrekt gespeichert. Ursache: Der Backend-Sanitizer ließ nur primitive Werte durch und verwarf stillschweigend Arrays und verschachtelte Objekte. Behoben durch einen rekursiven Sanitizer (max. Tiefe 5, max. Array 200, max. String 2000 Zeichen).
- **useLiveData Timer-Neustart (F-08-FE):** Der Polling-Timer wurde nach jedem Render neu gestartet, weil Callback-Referenzen (`onSuccess`, `onError`) instabil waren. Behoben durch das Refs-Pattern (`useRef` für Callbacks) – der Timer läuft jetzt stabil.
- **QueryBuilder-Duplikat (P-05):** In `movement-query.service.ts` war der gemeinsame Filter-Block doppelt vorhanden. Extrahiert in `applyBaseFilters()`.

### Security
- **Passwort-Hashes nicht mehr im Backup (SEC-013):** Das JSON-Backup exportierte bisher die bcrypt-Hashes aller Benutzer. Diese werden nun beim Export weggelassen. Die Restore-Funktion setzt für fehlende Hashes einen `$LOCKED$`-Sentinel – betroffene Accounts sind nach einem Restore gesperrt und müssen vom Administrator zurückgesetzt werden.
- **Log-Archive AES-256-GCM-Verschlüsselung (F-09):** Log-Archive werden nun optional verschlüsselt gespeichert. Aktivierung: Umgebungsvariable `LOG_ARCHIVE_ENCRYPTION_KEY` in der `.env` setzen. Bestehende Plaintext-Archive bleiben lesbar (rückwärtskompatibel).
- **Puppeteer-Sandbox bedingt (F-10):** `--no-sandbox` für Puppeteer (PDF-Export) wird jetzt nur noch gesetzt, wenn `PUPPETEER_DISABLE_SANDBOX=true` in der `.env` steht. Standard ist Sandbox aktiv.
- **Bulk-Import Rate-Limit (SEC-011):** Der Artikel-Bulk-Import ist auf 5 Anfragen pro Minute limitiert.

### Entfernt
- **react-color (F-13):** Abhängigkeit `react-color` (seit 2019 ohne Wartung) durch natives `<input type="color">` ersetzt. Kein Funktionsverlust.

### Technisch
- **Bestellungen-API paginiert (A-02):** `GET /purchasing` unterstützt jetzt `?page=&limit=` Parameter und gibt `{ orders, total, page, limit }` zurück. Standard-Limit 500 – kein Impact auf bestehende Clients.
- **Auto-Migration beim Container-Start:** `start.sh` führt Datenbankmigrationen automatisch aus. Kein manueller Eingriff mehr nötig.

---

## [4.1.0] – 2026-08-20

### Security
- **MFA (Zwei-Faktor-Authentifizierung):** Opt-in TOTP-MFA für alle Benutzerrollen.
- **Refresh-Token-Invalidierung (SEC-002):** Tokens werden beim Logout und Passwort-Änderung ungültig gemacht (DB-backed).
- **WebSocket JWT-Auth (SEC-001):** Socket.io-Gateway erfordert jetzt JWT-Authentifizierung; CORS auf erlaubte Origins beschränkt.
- **Content-Security-Policy (F-05-CSP):** `script-src 'unsafe-inline'` aus CSP entfernt.
- **Benutzer-Löschung auditiert (F-12):** Hard-Delete und Rollenänderungen werden in Audit-Logs festgehalten (NIS2).
- **Log-Bereinigung auditiert (F-04):** `deleteAllLogs()` hinterlässt jetzt einen Audit-Trail.

### DSGVO
- **PII aus Audit-Logs (F-02):** `sanitizeMetadata` entfernt E-Mail-Adressen und Benutzernamen aus gespeicherten Log-Metadaten.
- **Consent-Timestamp (F-06):** Datenschutz-Einwilligung wird mit ISO-Timestamp gespeichert (DSGVO Art. 7).

### Behoben
- **401-Burst nach Tab-Wechsel:** Mehrfach-Requests beim Wiederherstellen der Sichtbarkeit wurden durch `visibilitychange`-Debounce verhindert.
- **userId-NULL-Fix:** Token-Rotation-Race-Condition behoben – `userId` in Token-Refresh-Requests war gelegentlich null.
- **Offline-IDB-Fix:** Service-Worker-Konflikt beim Offline-Queue-Sync (IndexedDB) behoben.
- **Wareneingang Draft-Persistenz:** Vorgemerkte Positionen bleiben nach Tab-Wechsel erhalten.
- **Race Condition syncRestockRequest() (C-01):** Pessimistisches DB-Lock verhindert Doppelbuchungen.
- **recordMovement() außerhalb Transaktion (C-02):** Bewegungsbuchung läuft jetzt innerhalb der Transaktion.

### Technisch
- Docker-Backend läuft nicht mehr als root (DOCKER-ROOT – cap_drop, Gruppe 999).
- Passwort-Historik-Logik dedupliziert (DRY-PH – `password-history.util.ts`).
- Unbegrenzter `suggestionsCacheMap` Memory-Leak (S-01) behoben: TTL-basierter LRU-Cache.

---

## [4.0.0] – 2026-08-11

### Behoben
- **Kritisch: Passwort-Reset-E-Mail (F-01):** Parameter-Reihenfolge bei `sendPasswordResetEmail()` war vertauscht – Token landete im E-Mail-Body als Name, DisplayName in der Reset-URL. Behoben.
- **E-Mail-Laufzeit (F-07):** E-Mail nannte 24 Stunden, Token lief nach 1 Stunde ab. E-Mail korrigiert.

### Security
- **MySQL Port (SEC-004):** MySQL-Port von `0.0.0.0` auf `127.0.0.1` beschränkt (nur lokal erreichbar).
- **JWT-Laufzeit (SEC-008):** Access-Token auf 8h, Refresh-Token auf 90 Tage gesetzt.
- **UserRole-Enum-Validierung (SEC-005):** Ungültige Rollen werden am DTO abgewiesen.

---

## [3.9.1] – 2026-07-08

### Neu
- **Fahrzeug-Scanner Ein-/Ausbuchen-Modus:** Wechsel zwischen CHECK_IN und CHECK_OUT direkt per Toggle im Scanner.

---

## [3.9.0] – 2026-07-03

### Behoben
- **Bestellungs-PDF mehrseitig:** Mehrseitige Bestellungen wurden nach der ersten Seite abgeschnitten. Behoben.
