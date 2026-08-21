# Changelog

Alle nennenswerten Änderungen werden in dieser Datei dokumentiert.  
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

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
