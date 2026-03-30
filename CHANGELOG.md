# Changelog – KFZ Lagerverwaltung

Alle Änderungen werden hier dokumentiert.

**Versionsschema:**
- `X.Y.Z` – X = Major, Y = Minor (neue Funktionen), Z = Patch (Bugfixes)
- Patch +1 bei Bugfixes
- Minor +1 bei neuen Funktionen (bei 9 → Major +1, Minor → 0)

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
