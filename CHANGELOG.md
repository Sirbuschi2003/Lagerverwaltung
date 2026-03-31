# Changelog – Lagerverwaltung

Alle Änderungen werden hier dokumentiert.

---

## 2026-03-31

### [2.2.2] – Update-Mechanismus komplett überarbeitet

#### Neue Funktionen
- **Robustes Update-Script (`update.sh`)** — Eigenständiges Shell-Script wird direkt in das Docker-Image eingebettet (`/app/update.sh`). Erkennt automatisch ob `docker compose` (v2) oder `docker-compose` (v1) verfügbar ist. Funktioniert auf Synology, UGreen und allen anderen Linux-NAS-Systemen. Enthält Fallback per `docker restart` falls `docker compose up` fehlschlägt.
- **`--force-recreate --remove-orphans`** — Container werden jetzt immer neu erstellt, auch wenn sich nur das Image-Layer geändert hat.
- **Vereinfachte Update-Logik im Backend** — `runCompose()` und `execShell()` als saubere Hilfsmethoden; kein verschachtelter Callback-Hell mehr.
- **Bessere Fehlerdiagnose** — Log-Ausgaben zeigen welche Compose-Version erkannt wurde und was genau fehlschlägt.

#### Bugfixes
- **"Firefox kann keine Verbindung herstellen" nach Update** — `docker-compose up -d` startet Backend zuerst, Caddy erst danach. Das Frontend erkannte den Backend-Neustart (neue `instanceId`) und löste sofort `window.location.reload()` aus — genau wenn Caddy noch hochfuhr. Fix: `reloadWhenReady()` prüft alle 2 Sekunden ob die Seite selbst (durch Caddy) wieder erreichbar ist, bevor sie neu lädt. Max. 3 Minuten Wartezeit.
- **Update-Timeout auf 10 Minuten erhöht**



### [2.2.0] – Neue Funktionen

#### Neue Funktionen
- **Artikelbilder** — Zu jedem Ersatzteil kann ein Bild hochgeladen werden (JPEG/PNG/WebP, max 8 MB). Das Bild wird serverseitig automatisch auf max. 800×800 px skaliert und als JPEG gespeichert. Eigener Docker-Volume-Mount (`ITEM_IMAGE_STORAGE_HOST_PATH`), Bilder bleiben bei Updates erhalten.
- **Bild-Upload im Artikel-Dialog** — In der Artikel-Bearbeitung gibt es eine Vorschau und Buttons zum Hochladen/Entfernen ohne den Dialog zu schließen.
- **Thumbnail in der Artikelliste** — Artikel mit Bild zeigen ein 40×40 px Vorschaubild in der Tabelle.
- **Log-Übersicht neu gestaltet** — Aktivitäts-Feed statt Rohtabelle: menschenlesbare Meldungen, farbige Icons nach Kategorie, Datumsgruppen (Heute/Gestern), Kategoriefilter-Chips, Weitere-Laden statt Pagination.

### [2.1.3 – 2.1.5] – Inventur & Update-Fixes

#### Neue Funktionen
- **Inventur-Aufbewahrungspflicht (§ 257 HGB / § 147 AO)** — Abgeschlossene Inventuren können nicht mehr manuell gelöscht werden (403 Forbidden). Täglicher Cron-Job löscht automatisch nach 10 Jahren. Inventurliste zeigt errechnetes Löschdatum.

#### Bugfixes
- **Caddy startet nach Update nicht** — Volume-Mount verwendete `/workspace` statt Host-Pfad → relative Pfade im Compose-File lösten sich falsch auf. Fix: Mount am echten Host-Pfad.
- **Helper-Container startete Container nicht neu** — Container-interner Pfad statt Host-Pfad verwendet. Gelöst durch automatische Erkennung via Docker-Label `com.docker.compose.project.working_dir`.
- **Update-Timeout zu kurz für NAS-Hardware** — Backend-Timeout auf 8 Minuten erhöht.
- **Helper-Container Namenskonflikt** — Alter Container wird vor jedem Update-Versuch entfernt.

---

## 2026-03-30

### [2.0.0 – 2.1.2] – In-App Update-Funktion & CI/CD

#### Neue Funktionen
- **In-App Update-Funktion** — Manager kann direkt im Browser prüfen ob eine neue Version auf GitHub verfügbar ist und alle Docker-Container automatisch aktualisieren lassen.
- **Changelog-Anzeige vor dem Update** — Button „Was hat sich geändert?" lädt CHANGELOG.md von GitHub.
- **Update-Fortschrittsanzeige** — Stepper mit Phasen (Gestartet → Images herunterladen → Neu starten), Live-Log und automatischer Seiten-Reload.
- **Versionsnummer statt Git-SHA** — Anzeige zeigt `v2.1.0` statt Commit-Hash.
- **GitHub Actions CI/CD** — Automatischer Build & Push zu GHCR bei jedem Push auf `master`.

#### Bugfixes
- **Update-Polling hängt in Endlosschleife** — Stale-Closure-Bug durch `useRef` statt `useState` behoben.
- **`docker compose` vs `docker-compose`** — Alpine-Image nutzt v1 (Bindestrich); alle Skripte angepasst.
- **Update startet Container nicht** — Helper-Container-Ansatz eingeführt damit der Neustart nach dem Tod des Backend-Prozesses weiterläuft.
- **Update-Check: Branch `main` → `master`** — GitHub API wurde falsch befragt.
- **Rolle `ADMIN` → `MANAGER`** — Backend-Controller warf 403 weil interne Rolle `MANAGER` heißt.
- **GHCR: Großbuchstaben im Image-Tag** — `Sirbuschi2003` → `sirbuschi2003` via `tr`.

---

## [1.x.x] – Vorherige Versionen

Vor Einführung dieses Changelogs. System umfasste:
- Artikelverwaltung, Fahrzeugverwaltung, Bestandsverwaltung
- Inventur, Scanner, Offline-PWA mit Sync-Queue
- Bestellungen, Lieferanten, Lagerorte
- Benutzer- und Rollenverwaltung mit granularen Rechten
- PDF-/QR-/E-Mail-Templates, Datensicherung, Systemprotokoll
