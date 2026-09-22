# Changelog

Alle nennenswerten Änderungen werden in dieser Datei dokumentiert.  
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

---

## [4.7.4] – 2026-09-22 · Fehlmengen erscheinen jetzt sofort im Teilelager

> **Hintergrund:** Bei 30-50 gleichzeitigen Nutzern wäre das bisherige 15-Sekunden-Polling für Flotten-/Fehlmengenübersicht spürbar Dauerlast geworden, ohne dass Fehlmengen dadurch wirklich schneller sichtbar wurden – im ungünstigsten Fall lagen bis zu 15s zwischen einer Ausbuchung durch einen Außendiensttechniker und der Anzeige beim Teilelager.

### Verbesserung
- Fehlmengen-Übersicht im Teilelager-Dashboard reagiert jetzt per WebSocket sofort (statt bis zu 15s zu warten), sobald ein Techniker Teile ausbucht und dadurch eine neue Fehlmenge entsteht – nutzt das bereits bestehende `restock:updated`-Live-Signal des Backends. Das bisherige Polling bleibt als Fallback aktiv, falls die Socket-Verbindung kurzzeitig getrennt ist.
- Doppelte, fast zeitgleiche `GET /api/items`-Anfragen (mehrere Seiten/Effekte luden beim Start unabhängig voneinander den kompletten Artikelkatalog) werden jetzt gebündelt – ein bereits laufender Abruf wird geteilt statt dupliziert.

### Bugfix
- `PATCH /stock/vehicle/:id/target` (Zielmenge setzen) konnte mit einem 500er abbrechen, wenn für Fahrzeug+Artikel bereits ein Bestandseintrag existierte – Ursache war eine Suche nach Artikel+Fahrzeug, obwohl der eindeutige Datenbank-Index auf Artikel+Lagerort liegt; bei inkonsistenten Altdaten fand die Suche den vorhandenen Eintrag nicht und versuchte einen doppelten Insert. Suche jetzt konsistent zum tatsächlichen Index.

---

## [4.7.3] – 2026-09-22 · Veraltete Daten auf Büro-PCs behoben

> **Hintergrund:** Auf PCs mit stabiler Büro-Netzwerkverbindung zeigte praktisch jede Seite veraltete Daten, bis man F5 oder Strg+F5 drückte. Morgens nach dem Einschalten erschien die App außerdem oft fälschlich als "offline", bis man sich nach einem Reload neu anmeldete.

### Bugfix
- **Ursache:** Der Service Worker nutzte für mehrere zentrale Endpunkte (`/api/items`, `/api/stock/*`, `/api/vehicles`, `/api/auth/profile`, `/api/inventory/sessions`) "stale-while-revalidate" – sofort die alte gecachte Antwort anzeigen, im Hintergrund neu laden. Das wurde ursprünglich für Techniker mit schlechter/keiner Mobilfunkverbindung eingeführt (verhindert wiederholtes Warten auf einen ohnehin aussichtslosen Netzwerkversuch), sorgte auf Büro-PCs mit funktionierender Verbindung aber dafür, dass jede Seite konstant den Stand von "vorletztem Aufruf" zeigte – ein spürbares Update gab es erst beim übernächsten Laden.
- Betraf auch `/api/auth/profile`: ein über Nacht abgelaufener Login-Token lieferte trotzdem noch den (damals gültigen) gecachten Profil-Stand zurück, was den morgendlichen "sieht angemeldet aus, aber offline"-Effekt erklärt.
- **Fix:** Auf "network-first" umgestellt – Netzwerk wird zuerst versucht (max. 3s), erst bei echtem Fehlschlag greift der Cache als Fallback. Ein Techniker ohne Route zum Server bekommt einen Verbindungsfehler i.d.R. deutlich schneller als die 3s-Grenze, der Offline-Fallback bleibt also praktisch gleich schnell wie zuvor – PCs mit funktionierender Verbindung sehen jetzt aber immer den echten aktuellen Stand ohne manuellen Reload.
- Damit gegenstandslos gewordene `Cache-Control: no-cache`-Sonderbehandlung an drei Stellen entfernt (war ein früherer Workaround für genau dieses Problem, betraf aber nur einzelne Endpunkte statt der Ursache).

---

## [4.7.2] – 2026-09-21 · Log-Suche findet jetzt Artikelnummern

> **Hintergrund:** Nutzer erwarteten, dass sich die Systemprotokolle-Suche z.B. nach einer Artikelnummer durchsuchen lässt (die Nummer wird in der Detailansicht schließlich prominent angezeigt). Tatsächlich durchsuchte das Suchfeld bislang nur die interne Aktions-Kennung (z.B. "STOCK_MOVEMENT"), nicht den Beschreibungstext oder die Artikeldaten.

### Bugfix
- Freitextsuche in den Systemprotokollen durchsucht jetzt zusätzlich den Beschreibungstext (`details`) sowie Artikelcode/-bezeichnung aus den Metadaten – sowohl in der Live-Tabelle als auch im Archiv (konsistent, damit beim Übergang eines Eintrags von aktiv zu archiviert keine Treffer verschwinden).
- Nebenbei gefunden: Ein alleiniges "Von"-Datum ohne "Bis" wurde bislang beim Live-Log-Filter komplett ignoriert (nur bei beiden gesetzten Werten wirksam) – jetzt funktioniert auch ein offenes Zeitfenster.

---

## [4.7.1] – 2026-09-21 · Artikelbilder: Verkleinerung vor dem Upload

> **Hintergrund:** Artikelbilder liessen sich weder vom Handy noch vom PC hochladen. Backend-Logs zeigten teils Erfolg, teils nichts – Verdacht fiel auf grosse Rohfotos direkt von der Handykamera (z.B. 10MB+), die bei schlechter Verbindung im Lager/Feld den Upload schon vor der serverseitigen Verkleinerung (bestehende sharp-Kompression auf 800x800) scheitern liessen.

### Neue Funktion
- Artikelbilder werden jetzt **vor dem Hochladen im Browser verkleinert** (`frontend/src/utils/imageCompression.ts`, Canvas-basiert, max. 1600px Kantenlänge, JPEG-Qualität 85%) – betrifft beide Upload-Wege (Artikel-Bearbeiten-Dialog inkl. direkter Kamera-Aufnahme auf Mobilgeräten).
- Fehlermeldungen beim Bild-Upload zeigen jetzt den konkreten Grund an (z.B. Berechtigung, Dateiformat) statt nur "Bild konnte nicht hochgeladen werden."
- Live verifiziert: 12,5MB-Testfoto wurde im Browser auf 0,74MB verkleinert und erfolgreich hochgeladen.

---

## [4.7.0] – 2026-09-18 · Log-Suche über Archiv hinweg

> **Hintergrund:** Nach der automatischen Log-Archivierung (4.6.1) landen ältere Protokolle nicht mehr in der Live-Tabelle. Damit eine Suche danach nicht "leer" wirkt, sucht die bestehende Systemprotokolle-Suche jetzt transparent auch im Archiv mit.

### Neue Funktion
- **Zeitraum-Filter ("Von"/"Bis" mit Datum und Uhrzeit)** in den Systemprotokollen ergänzt (bisher nur Kategorie und Freitext).
- Sobald ein Super-Admin ein "Von"-Datum setzt, das in die Vergangenheit reicht, durchsucht die Suche automatisch auch bereits archivierte Tage – kombiniert mit Kategorie-, Level- und Freitext-Filtern. Treffer aus dem Archiv sind mit einem "Archiv"-Chip gekennzeichnet und enthalten (DSGVO-Datensparsamkeit) keinen gespeicherten Benutzernamen, nur die Benutzer-ID.
- Aus Performance-Gründen pro Anfrage auf max. ca. 400 gescannte Archiv-Tage begrenzt; ein Hinweis in der Filterleiste zeigt an, wenn eingegrenzt werden sollte.
- Handbuch (Systemprotokolle) entsprechend ergänzt.

### Bugfix
- **Archiv-Aufbewahrung auf der Seite "Protokoll-Archiv" hatte keine Wirkung:** Das Eingabefeld erlaubte 1–3650 Tage und bestätigte jede Eingabe als gespeichert, aber `cleanupOldArchives()` erzwingt ohnehin ein hartes 10-Jahre-Minimum (GoBD §147 AO) – ein eingegebener kleinerer Wert (z. B. 30 Tage) wurde also nie tatsächlich angewendet, obwohl die Seite "Aktualisiert" meldete. Backend lehnt Werte unter 3650 Tagen jetzt mit klarer Fehlermeldung ab, Eingabefeld und Vorschlagswert entsprechend korrigiert. Getrennt davon bleibt die "Aktiv-Aufbewahrung (Tage bis Archiv)" auf der Systemprotokolle-Seite unverändert frei einstellbar (1–3650 Tage) – das betrifft nur, wie lange Logs in der schnellen Live-Tabelle bleiben, nicht deren endgültige Löschung.

---

## [4.6.1] – 2026-09-16 · Bestellungs-Archivierung & Log-Wachstum

> **Hintergrund:** Zwei Vorfälle am selben Tag: manuelles Archivieren von Bestellungen wurde als unnötiger Zusatzschritt empfunden, und eine produktive `system_logs`-Tabelle war auf 130.000 Zeilen (~75MB) angewachsen, weil die vorhandene Archivierungsfunktion nie automatisch lief.

### Bugfixes
- **Bestellungen archivieren sich jetzt automatisch:** Ein vollständiger Wareneingang setzte den Status bisher auf ERHALTEN (RECEIVED), Archivieren war ein separater, manueller Klick. Springt jetzt bei vollständigem Wareneingang direkt auf ARCHIVIERT.
- **Log-Archivierung lief nie automatisch:** Es gab bereits eine Funktion, die alte Protokolle (Standard: älter als 90 Tage) aus `system_logs` in verschlüsselte Archivdateien auslagert – aber ohne Cron-Job, nur per manuellem Super-Admin-Klick, der in der Praxis nie betätigt wurde. Neuer täglicher Job (04:00 Uhr) übernimmt das jetzt automatisch.
- **`getPastDatesInDb()` lieferte MySQL-`DATE`-Werte als JS-`Date`-Objekte statt als `"YYYY-MM-DD"`-Strings** (mysql2-Verhalten) – dadurch scheiterte die Regex-Validierung in `archiveLogs()` für jedes Datum, wodurch auch der bereits vorhandene manuelle „Alle archivieren"-Button faktisch nie funktioniert hätte. Behoben mit `DATE_FORMAT()` statt `DATE()`.

### Dokumentation
- Handbuch (Bestellungen, Systemprotokolle) an die neue automatische Archivierung angepasst.

---

## [4.6.0] – 2026-09-16 · Monatlicher Dependency-Checkup

> **Hintergrund:** Erster turnusmäßiger Sicherheits-Checkup: veraltete Abhängigkeiten geprüft und auf aktuelle, sichere Versionen angehoben, jeweils mit Build/Typecheck/E2E-Test bzw. Live-Test in Docker verifiziert.

### Backend
- **NestJS-Kern auf v11** angehoben (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/platform-socket.io`, `@nestjs/websockets`, `@nestjs/testing`, `@nestjs/cli`, `@nestjs/schematics`) sowie `@nestjs/config`, `@nestjs/jwt`, `@nestjs/mapped-types`, `@nestjs/passport`, `@nestjs/schedule`, `@nestjs/typeorm` auf die jeweils neuesten kompatiblen Versionen. v12 bewusst noch nicht verwendet: `@nestjs/throttler` unterstützt es upstream noch nicht offiziell (Peer-Dependency-Konflikt).
- `sharp`, `nodemailer`, `adm-zip`, `pdfkit`, `puppeteer`, `class-validator`, `reflect-metadata` auf aktuelle Hauptversionen angehoben. Puppeteers `setContent()` unterstützt `waitUntil: "networkidle0"` nicht mehr (entfernt) – auf `"load"` umgestellt (betrifft Bestell- und Berichts-PDF-Erzeugung).
- `@nestjs/jwt` v12 verlangt einen gebrandeten `ms.StringValue`-Typ für `expiresIn` statt eines einfachen `string` – an den drei betroffenen Stellen (`auth.module.ts`, `stock.module.ts`, `auth.service.ts`) entsprechend typisiert.
- Dev-Tooling: `jest`/`ts-jest`/`@types/jest` auf v30 (CLI-Flag `--testPathPattern` → `--testPathPatterns` in `test:e2e`-Script angepasst), `rimraf` sowie diverse `@types/*`-Pakete aktualisiert.
- **Ergebnis:** 54 → 13 offene npm-audit-Findings (verbleibend: `multer`-DoS über den v12-Sprung blockiert durch `@nestjs/throttler`, sowie `exceljs`/`uuid` über eine sehr frisch veröffentlichte TypeORM-v1-Major-Version, siehe unten).

### Frontend
- **React 19**, **React Router v7** sowie `date-fns`, `idb`, `@zxing/browser`/`@zxing/library`, `papaparse`, `react-rnd` auf aktuelle Hauptversionen angehoben.
- **Ergebnis:** 32 → 3 offene npm-audit-Findings (verbleibend: `esbuild`/`vite`-Dev-Server-Schwachstelle, betrifft nicht den produktiven Build).

### Bewusst zurückgestellt (zu frisch/riskant für einen automatisierten Checkup)
- **TypeORM v1.x** – erst zwei Wochen alt (nach Jahren auf 0.3.x), kein Track Record für eine produktiv genutzte Datenschicht.
- **MUI v9** (bzw. v6–v9 in Summe) – Update auf `@mui/material@latest` erzeugte 439 TypeScript-Fehler durch mehrere API-Brüche (u. a. `InputProps`, `Stack`/`Grid`-Props). Eigene, dedizierte Migration nötig.
- **Vite v8** – nutzt intern den neuen "rolldown"-Bundler mit ungelösten Peer-Konflikten in dessen eigenem Babel-8-Zweig; zu unausgereift.
- **Zustand v5** – geänderte Default-Vergleichslogik für Selektoren verursachte einen React-Endlos-Render-Fehler (#185) direkt beim App-Start; ohne Audit aller Store-Aufrufstellen (`useShallow`) nicht sicher migrierbar.
- **TypeScript 7** – kompletter Compiler-Neubau, erst ganz frisch als "latest" markiert.
- **ESLint 9/10** (Backend + Frontend) – erfordert Migration auf das neue Flat-Config-Format (`eslint.config.*`), eigener Aufwand unabhängig vom Versions-Update selbst.

### Nebenbei gefunden (nicht Teil dieses Updates, separat vorgemerkt)
- Super-Admin-Benutzer (`branchId = null`) können keine Lagerorte anlegen (`POST /api/locations` wirft HTTP 500) – vorbestehender Bug, unabhängig vom Dependency-Update.

---

## [4.5.0] – 2026-09-15 · Mobile Performance & Offline-Stabilität

> **Hintergrund:** Techniker im Feld arbeiten praktisch durchgehend offline (der Server ist von außen grundsätzlich nicht erreichbar). Nach ersten Performance-Fixes (v4.4.0) blieb die App auf Handys weiterhin träge bzw. hing sich teils komplett auf. Dieses Release behebt die tatsächlichen Ursachen, jeweils live gegen einen echten (gestoppten) Backend-Container bzw. mit realistischen Datenmengen nachgewiesen — nicht nur per Code-Analyse.

### Bugfixes – Offline-Hänger
- **Kaltstart-Race in der Offline-Erkennung (`useNetworkStore.ts`):** `isEffectivelyOffline()` meldete bei jedem App-Start/Reload für bis zu 3 Sekunden fälschlich „online", solange der erste Backend-Erreichbarkeits-Check noch nicht durchgelaufen war. In diesem Fenster feuerten alle gleichzeitig geöffneten Tabs (Dashboard, Artikeldaten, Mein Fahrzeug) gleichzeitig Live-Anfragen ab, die einzeln scheitern/timeouten mussten — Hauptursache für „App hängt nach dem Start". Betroffene Stellen in `useAuthStore.ts` (Login/Token-Refresh) und `AppLayout.tsx` (Fahrzeug-Kennzeichen-Anzeige) ebenfalls auf die korrekte Erkennung umgestellt.
- **Service Worker (`sw.js`):** Cacheable API-Endpunkte (Artikel, Fahrzeuge, Bestand, Profil) nutzen jetzt Stale-while-Revalidate statt bei jedem Aufruf zuerst bis zu 3 Sekunden auf das Netzwerk zu warten, bevor der Cache greift.
- **Artikeldaten ohne Pagination im Offline-Modus:** Online lädt die Artikelseite immer nur 50 Artikel pro Seite vom Server; offline wurde stattdessen der komplette gecachte Katalog (bei großen Beständen mehrere tausend Artikel) ungefiltert und ungepaginiert gerendert — Hauptursache für „einmal Artikeldaten offline geöffnet, dann hängt die ganze App". Filterung (Suche/Hersteller/Warengruppe) und Pagination laufen jetzt auch offline clientseitig korrekt; als Nebeneffekt funktioniert die Artikelsuche dadurch jetzt auch offline.
- **Mein Fahrzeug ohne Pagination:** Gleiches Muster wie bei den Artikeldaten — bei mehr als ~100 Artikeln auf dem Fahrzeug wurden alle Zeilen (mobile Kartenansicht wie Desktop-Tabelle) auf einmal gerendert. Jetzt paginiert (25 pro Seite); Suche und Scan-Erkennung arbeiten weiterhin auf dem kompletten Fahrzeugbestand.
- **IndexedDB-Bulk-Writes blockierten die App:** Der Artikel-Cache schrieb beim Synchronisieren jeden Datensatz einzeln mit eigenem `await` (bei großen Katalogen tausende sequentielle Event-Loop-Durchläufe). Läuft jetzt als Batch innerhalb einer Transaktion.

### Bugfixes – Dauerhafte Hintergrundlast
- **WebSocket-Reconnect-Sturm:** Zwei Stellen (Restock-Benachrichtigungen, Schnellbuchung-Live-Sync) versuchten bei fehlgeschlagener Verbindung mit Standardeinstellungen unbegrenzt oft alle 1–5 Sekunden erneut zu verbinden — dauerhaft im Hintergrund, unabhängig von der gerade geöffneten Seite. Gemessen: ca. 1 Fehlversuch pro Sekunde im Leerlauf. Jetzt sanfterer Backoff (bis max. 30s) plus zuverlässige Offline-Prüfung vor dem ersten Verbindungsversuch.
- **Unnötige Re-Renders:** Fünf Seiten abonnierten den kompletten Artikel-Store statt einzelner Felder und rendern dadurch bei jeder Store-Änderung neu, obwohl sie über das Tab-System dauerhaft im Hintergrund gemountet bleiben. Auf gezielte Selektoren umgestellt.

### Bugfixes – Bestand & Anforderungen
- **Offene Anforderungen blieben nach Bestandsauffüllung fälschlich „PENDING":** Ein Fix vom 05.09.2026 gegen blockierende Hintergrund-Abgleiche hatte einen Nebeneffekt: Wurde der Anforderungs-Abgleich direkt nach einer Bestandsbuchung aufgerufen, sah er die eigene, noch offene Transaktionssperre als „belegt" an und übersprang die Synchronisation stillschweigend. Techniker buchten Artikel korrekt ein, die zugehörige Anforderung verschwand aber nicht aus der Übersicht.
- **Buchungen konnten ohne Benutzerzuordnung landen:** Manuelle „Ist-Bestand anpassen"-Buchungen konnten mit `userId = NULL` gespeichert werden, wodurch sich im Nachhinein nicht mehr nachvollziehen ließ, wer eine Korrektur vorgenommen hat. Die Buchung wird jetzt immer der authentifizierten Session zugeordnet.

---

## [4.4.0] – 2026-09-09 · Deployment-Infrastruktur & Code-Qualität

### Deployment / CI
- **GitHub Actions → ghcr.io:** Neuer Workflow `docker-publish.yml` baut Backend und Frontend bei jedem Push auf `master` automatisch und veröffentlicht sie als Images unter `ghcr.io/sirbuschi2003/lagerverwaltung-{backend,frontend}`. Kein lokales Bauen mehr auf NAS/Portainer nötig.
- **`docker-compose.portainer.yml` (neu):** Eigenständiger Stack für Neuaufsetzungen über Portainer GitOps, ausschließlich mit fertigen ghcr.io-Images. Feste, stackname-unabhängige Volume-Namen (`lagerverwaltung_mysql_data`, `_backups`, `_purchase_orders`) verhindern Verwechslungen bei Redeploys. `APP_HOST`/`ALLOWED_ORIGINS` für CORS, `COOKIE_SECURE=false` als Default für Deployments ohne eigene TLS-Terminierung.
- **`NAS-SETUP.md` (neu):** Schritt-für-Schritt-Anleitung für ein komplett neues System ohne technisches Vorwissen, inklusive eindeutigem Reset-Pfad bei Problemen.
- **`COOKIE_SECURE`-Umgebungsvariable:** Refresh-Token-Cookie war hart an `NODE_ENV=production` gekoppelt (`secure: true`), wodurch es auf HTTP-only-Systemen (ohne Reverse-Proxy/TLS) vom Browser verworfen wurde → Nutzer wurden nach Ablauf des Access-Tokens ausgeloggt ("Kein Refresh-Token gefunden"). Jetzt explizit konfigurierbar.

### Bugfixes
- **Docker-Healthcheck:** `backend/Dockerfile` prüfte `/health` statt `/api/health` (globaler API-Präfix) — der Backend-Container zeigte dauerhaft fälschlich „unhealthy", obwohl er einwandfrei lief.
- **nginx Upload-Limit:** `client_max_body_size` fehlte im Frontend-nginx — ZIP-Backup-Wiederherstellung über einige MB schlug mit HTTP 413 fehl.
- **Wareneingang (`purchasing.service.ts`):** Vollständiger Wareneingang setzte fälschlich Status `ARCHIVED` statt `RECEIVED` (ARCHIVED ist ein separater, manueller Schritt). PDF-Speicherfehler (z. B. Docker-Volume-Rechte) ließen den gesamten Status-Wechsel mit HTTP 500 fehlschlagen, obwohl der DB-Status bereits committed war — jetzt CRITICAL-Log statt Request-Fehler.
- **Restock-Workflow (`stock.service.ts`):** Background-Sync hielt `pessimistic_write`-Locks ohne `SKIP LOCKED` und blockierte parallele Nutzer-Transaktionen (z. B. FULFILLED-Buchung) bis zu 50 Sekunden (MySQL-Lock-Timeout).
- **Artikelsuche nach Alias-/Alternativ-Code (`items.service.ts`):** `item_codes.branchId` ist `NOT NULL` (seit Migration `ItemCodesPerBranch`), vier Codestellen nutzten dennoch `IsNull()` als Fallback-Filter für Alias-Suche und Duplikat-Prüfung — traf dadurch nie eine Zeile. Betraf u. a. die niederlassungsübergreifende Suche (Super-Admin) nach Artikeln per Alternativ-Code, die fälschlich „nicht gefunden" meldete.
- **Backup-Sicherheitsnetz (`setup.service.ts`, `streamFullArchive`):** Die Passwort-Hash-Bereinigung für den vollständigen ZIP-Export griff auf den falschen Objektpfad zu (`backup.users` statt `backup.data.users`) und lief dadurch nie. Kein aktives Datenleck (`createBackup()` befüllt `passwordHash` ohnehin nie), aber das SEC-013-Sicherheitsnetz war wirkungslos — jetzt korrekt.

### Code-Qualität
- **1382 ESLint-Fehler auf 0 reduziert** (gesamter Backend-Code). Wesentliche Ursachen: fehlende globale Typisierung von `req.user` (jetzt via `src/types/express.d.ts`), durchgängig `any`-typisierte Backup/Restore-Payloads (jetzt vollständig typisiert in `src/modules/setup/backup-payload.types.ts`), sowie verstreute `any`-Nutzung in ca. 76 weiteren Dateien. Reine Typsicherheits-Bereinigung ohne Verhaltensänderung (unabhängig verifiziert: Build, Lint und E2E-Test grün).

---

## [4.3.0] – 2026-09-05 · Security & Compliance Release (inkl. Ergänzungen 05.09.2026)

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
- **docker-compose.yml:** `DEFAULT_ADMIN_PASSWORD`, `INVENTORY_HMAC_SECRET`, `DB_POOL_SIZE` als Env-Variablen ergänzt (05.09.2026).
- **TypeORM-Migration `1755600000000-SecurityHardeningFixes`:** Bereinigt abgelaufene Password-Reset-Tokens und legt einen Index auf `password_reset_tokens.token` an. Spaltennamen auf TypeORM-Konvention (`expiresAt`, `createdAt`) korrigiert.

### DSGVO-002 – Consent-Management (Art. 6/7) — *05.09.2026*
- Neues Modul `ConsentModule` mit Entity `UserConsent`, `ConsentService` und `ConsentController`.
- **Endpunkte:**
  - `GET /consent` — aktive Einwilligungen des aktuellen Benutzers
  - `GET /consent/history` — komplette Einwilligungshistorie
  - `POST /consent` — Einwilligung gewähren oder aktualisieren (purpose, version, granted, IP-anon., UA)
  - `DELETE /consent/:purpose` — Einzelne Einwilligung widerrufen
  - `DELETE /consent` — Alle Einwilligungen widerrufen (z. B. vor Konto-Löschung)
- **Migration `1755800000000-CreateUserConsents`:** Neue Tabelle `user_consents` mit Indizes auf `userId`, `purpose`.
- IP-Adressen werden beim Speichern automatisch anonymisiert (IPv4: letztes Oktett → 0, IPv6: ab Gruppe 4 → 0).

### GOB-003 – Einstandspreise (§240 HGB) – Frontend *05.09.2026*
- Bestellwizard und `ActiveOrdersTab`: optionale Felder `Netto-Preis` und `MwSt.` pro Position.
- Anzeige von `Netto/Stk.` und `Gesamt netto` in der Bestell-Detailansicht.
- API-Typen (`PurchaseOrderLineDto`, `createPurchaseOrder`, `addPurchaseOrderLine`, `updatePurchaseOrderLine`) erweitert.
- TypeORM-Entity `PurchaseOrderLine`: explizite `name`-Attribute für `unit_price_net` und `tax_rate` ergänzt (Mapping zwischen camelCase-Property und snake_case-Spalte).

### Bugfixes Wareneingang + Restock-Workflow *05.09.2026*
- **BUG-001 – PDF-Speicherung nicht mehr request-blockierend:** `saveOrderPdfToStorage()` wirft bei Filesystem-Fehlern (z.B. Docker-Volume-Berechtigungen) keinen HTTP 500 mehr auf den bereits committeten Status-Wechsel. Stattdessen CRITICAL-Log für manuelle Nacherfassung (§257 HGB Nachvollziehbarkeit bleibt erhalten).
- **BUG-002 – Status RECEIVED statt ARCHIVED bei vollständigem Wareneingang:** `receiveOrder()` setzte fälschlicherweise `status = ARCHIVED` wenn alle Positionen eingegangen waren. Korrekt ist `RECEIVED`; ARCHIVED ist ein separater manueller Schritt.
- **BUG-003 – Background-Sync ohne Lock-Konflikt:** `syncRestockRequest()` verwendete `pessimistic_write` ohne `SKIP LOCKED` — Background-Syncs aus `getRestockOverview()` blockierten FULFILLED-Transaktionen für bis zu 50 Sekunden (MySQL `innodb_lock_wait_timeout`). Fix: `onLocked: 'skip_locked'`.
- **E2E-Test:** `jest.setTimeout(120_000)` für Docker-WSL2-Netzwerklatenz; Testergebnis gespeichert unter `backend/test-results/e2e-result-2026-09-05.json`.

### GOB-005 – GDPdU-Export (§147 AO / §257 HGB) *05.09.2026*
- Neuer Service `GdpduExportService` erstellt ZIP-Archiv im GDPdU-Format (IDEA-kompatibel):
  - `index.xml` – Tabellenstruktur und Metadaten (Unternehmen, Zeitraum, DTD-Referenz)
  - `gdpdu-01-09-2004.dtd` – GDPdU-DTD für Steuerprüfer-Software
  - `Lagerbewegungen.csv` – alle Lagerbewegungen im Exportzeitraum
  - `Bestellungen.csv` – Bestellkopfdaten inkl. Gesamtbetrag netto
  - `Bestellpositionen.csv` – Positionen mit Einstandspreisen (§240 HGB)
  - `Artikel.csv` – Artikelstammdaten
  - `Lieferanten.csv` – Lieferantenstammdaten
- Neuer Endpunkt `GET /api/reports/gdpdu?from=YYYY-MM-DD&to=YYYY-MM-DD` (Rolle: MANAGER).
- Frontend: Download-Button „GDPdU-Export" in Berichte & Analysen (nur MANAGER sichtbar).

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
