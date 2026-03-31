# Changelog – Lagerverwaltung

Alle Änderungen werden hier dokumentiert.


## [2.2.0] – 2026-03-31

### Neue Funktionen
- **Artikelbilder** — Zu jedem Ersatzteil kann ein Bild hochgeladen werden (JPEG/PNG/WebP, max 8 MB). Das Bild wird serverseitig automatisch auf max. 800×800 px skaliert und als JPEG gespeichert. Eigener Docker-Volume-Mount (`ITEM_IMAGE_STORAGE_HOST_PATH`), Bilder bleiben bei Updates erhalten.
- **Bild-Upload im Artikel-Dialog** — In der Artikel-Bearbeitung (ItemEditDialog) gibt es eine Vorschau des aktuellen Bildes und Buttons zum Hochladen bzw. Entfernen ohne den Dialog zu schließen.
- **Thumbnail in der Artikelliste** — Artikel mit hinterlegtem Bild zeigen ein 40×40 px Vorschaubild in der Desktop-Tabellenansicht.
- **Log-Übersicht neu gestaltet** — Aktivitäts-Feed statt Rohtabelle: menschenlesbare Meldungen („Thomas hat 3× Bremsbelag ausgebucht"), farbige Icons nach Kategorie (Buchungen/Bestellungen/Inventur/…), Datumsgruppen (Heute/Gestern), Kategoriefilter-Chips. Log-Verwaltung in ausklappbarer Sektion. Weitere Einträge nachladen statt Pagination.

---

## [2.1.5] – 2026-03-31

### Bugfixes
- **In-App Update: Caddy startet nach Update nicht** — Root Cause: Der Helper-Container mountete das Projektverzeichnis als `/workspace`, docker-compose löste relative Pfade (`./deploy/caddy/Caddyfile.main`) daher zu `/workspace/...` auf. Auf dem Host existiert `/workspace` nicht → Caddy-Container blieb im Status "Created" hängen. Fix: Volume wird jetzt am echten Host-Pfad gemountet (`/volume1/docker/Lagerverwaltung:/volume1/docker/Lagerverwaltung`) und docker-compose mit diesem Pfad als Compose-File aufgerufen.

---

## [2.1.4] – 2026-03-31

### Bugfixes
- **In-App Update: Helper-Container startete die Container nicht neu** — Root Cause: Der Helper-Container wurde als Sibling-Container über den Docker-Socket gestartet und benötigte daher HOST-Pfade für Volume-Mounts. Der Code verwendete jedoch den Container-internen Pfad `/workspace` statt des Host-Pfades (`/volume1/docker/Lagerverwaltung`), weshalb die `docker-compose.main.yml` im Helper nicht gefunden wurde und der Neustart lautlos fehlschlug. Gelöst durch automatische Erkennung des Host-Pfads via Docker-Label `com.docker.compose.project.working_dir` (kein manueller Konfigurationsaufwand). Fallback: `HOST_PROJECT_PATH` in `.env` setzen.
- **Update-Timeout zu kurz für NAS** — Backend-Timeout von 5 auf 8 Minuten erhöht, Frontend-Fallback-Reload von 3 auf 6 Minuten (Synology NAS-Hardware braucht länger zum Container-Start)
- **Helper-Container Namenskonflikt** — Alter `lager-update-helper` Container wird jetzt vor jedem Update-Versuch entfernt (`docker rm -f`)

---

## [2.1.3] – 2026-03-31

### Neue Funktionen
- **Inventur-Aufbewahrungspflicht (§ 257 HGB / § 147 AO)** — Abgeschlossene Inventuren (Status: Finalisiert) können nicht mehr manuell gelöscht werden; das Backend gibt `403 Forbidden` mit Hinweis auf die gesetzliche Grundlage zurück
- **Automatische Löschung nach 10 Jahren** — Täglicher Cron-Job (03:00 Uhr) löscht finalisierte Inventuren automatisch sobald die gesetzliche Aufbewahrungsfrist abgelaufen ist; Löschvorgang wird im System-Log protokolliert
- **Löschdatum in der Inventur-Liste** — Finalisierte Inventuren zeigen nun einen Info-Chip mit dem errechneten automatischen Löschdatum (Finalisierungsdatum + 10 Jahre); Tooltip erläutert die gesetzliche Grundlage

---

## [2.1.2] – 2026-03-30

### Bugfixes
- **Update-Polling hängt in Endlosschleife** — Stale-Closure-Bug: `waitingForRestart` State-Variable wurde im `setInterval`-Callback nie aktualisiert (eingefroren beim Start). Gelöst durch `useRef` (`backendWentOfflineRef`) statt State für den Polling-Callback. Zusätzlich 3-Minuten-Fallback-Timeout der auf jeden Fall neu lädt.

---

## [2.1.1] – 2026-03-30

### Bugfixes
- **Update startet Container nicht** — `docker compose up -d` tötete den laufenden Backend-Container bevor der neue starten konnte; neuer Container blieb in „Created"-Zustand hängen. Gelöst durch unabhängigen Helper-Container der den Neustart übernimmt nachdem unser Prozess gestorben ist.
- **`docker compose` vs `docker-compose`** — Im Alpine-Image ist `docker-compose` (v1, Bindestrich) installiert; Skripte verwendeten `docker compose` (v2, Leerzeichen). Alle Skripte auf `docker-compose` umgestellt.

---

## [2.1.0] – 2026-03-30

### Neue Funktionen
- **Versionsnummer statt Git-SHA** — Anzeige zeigt nun `v2.1.0` statt `b3c305d`; GitHub Actions setzt Git-Tag mit package.json-Version
- **Changelog-Anzeige vor dem Update** — Button „Was hat sich geändert?" lädt CHANGELOG.md von GitHub und zeigt ihn direkt in der Oberfläche an
- **Update-Fortschrittsanzeige** — Stepper mit Phasen (Gestartet → Images herunterladen → Container neu starten), Live-Log-Ausgabe und automatischer Seiten-Reload nach Neustart
- **Backend: Datenbank-Wartungs-Endpunkte** — `GET /maintenance/check` und `POST /maintenance/fix` waren nicht implementiert; vollständiges `MaintenanceModule` erstellt
- **Changelog-Endpunkt** — `GET /update/changelog` liefert CHANGELOG.md direkt aus GitHub

### Bugfixes
- **Update lief nicht durch** — Frontend-Polling startete zu früh und lud Seite neu bevor Docker-Pull abgeschlossen war; komplette Update-Flow-Logik überarbeitet

---

## [2.0.2] – 2026-03-30

### Bugfixes
- **Update-Check: Branch `main` → `master`** — GitHub API wurde nach Branch `main` gefragt, das Repo nutzt jedoch `master`; Fehler: „No commit found for SHA: main"

---

## [2.0.1] – 2026-03-30

### Bugfixes
- **Update-Funktion: Rolle `ADMIN` → `MANAGER`** — Backend-Controller warf bei jedem Update-Versuch `403 Forbidden`, da die interne Admin-Rolle `MANAGER` heißt, nicht `ADMIN`
- **Update-Badge im Header zeigte nie an** — AppHeader prüfte auf Rolle `ADMIN` statt `MANAGER`, Badge war daher für keinen Benutzer sichtbar
- **Dev-Version blockierte Update-Check** — Version `dev` wurde als Fehler zurückgegeben statt GitHub-Vergleich durchzuführen; jetzt gilt `dev` = immer veraltet
- **GitHub Actions: Großbuchstaben im Image-Tag** — GHCR erlaubt keine Großbuchstaben; `Sirbuschi2003` → `sirbuschi2003` via `tr '[:upper:]' '[:lower:]'`
- **Docker-Build: `addgroup nestjs docker` schlug fehl** — Alpine-Image enthält keine `docker`-Gruppe; gelöst durch `USER root` für Update-Funktion
- **Wartungsseite nicht erreichbar** — Kein Navigationslink vorhanden; Eintrag „Wartung & Update" unter Einstellungen im NavigationDrawer hinzugefügt

---

## [2.0.0] – 2026-03-30

### Neue Funktionen
- **In-App Update-Funktion** — Admin kann direkt in der Weboberfläche prüfen ob eine neue Version auf GitHub verfügbar ist und alle Docker-Container automatisch aktualisieren
  - Backend: `UpdateModule` mit `GET /update/status` und `POST /update/apply`
  - Frontend: Update-Sektion auf Wartungsseite (`/settings/maintenance`)
  - Header: Update-Badge und Chip für Admins wenn neue Version verfügbar
  - Docker-Socket wird in Backend-Container gemountet für Container-Neustart
- **GitHub Actions CI/CD** — Automatischer Build und Push der Docker-Images zu GitHub Container Registry (GHCR) bei jedem Push auf `master`
  - Images: `ghcr.io/sirbuschi2003/lagerverwaltung-backend:latest`
  - Images: `ghcr.io/sirbuschi2003/lagerverwaltung-frontend:latest`
  - Git-Commit-SHA wird als `APP_VERSION` in Backend-Image eingebaut
- **Navigationslink Wartung & Update** — Neuer Menüpunkt unter Einstellungen

### Technische Änderungen
- `docker-compose.main.yml`: `name: lagerverwaltung` gesetzt (stabiler Projektname), GHCR-Images referenziert, Docker-Socket + Workspace-Volume für Update-Funktion
- `backend/Dockerfile`: `APP_VERSION` Build-Arg, `docker-cli` + `docker-compose` installiert

---

## [1.x.x] – Vorherige Versionen

Vor Einführung dieses Changelogs. System umfasste:
- Artikelverwaltung, Fahrzeugverwaltung, Bestandsverwaltung
- Inventur, Scanner, Offline-PWA mit Sync-Queue
- Bestellungen, Lieferanten, Lagerorte
- Benutzer- und Rollenverwaltung mit granularen Rechten
- PDF-/QR-/E-Mail-Templates, Datensicherung, Systemprotokoll
