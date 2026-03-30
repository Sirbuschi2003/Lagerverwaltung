## KFZ Teilelager Plattform

Containerisierter Fullstack-Stack fuer Fahrzeuginventur inklusive offlinefaehiger PWA, QR-Scanner und MySQL-Datenbank. Laesst sich mit einem Befehl auf beliebigen Docker-Hosts starten.

### Komponenten
- `backend/` – NestJS 10 + TypeORM (MySQL), Module fuer Artikel, Fahrzeuge, Bewegungen, Inventur, Berichte und Authentifizierung.
- `frontend/` – React/Vite PWA (Material UI, QR-Scanner, IndexedDB Offline-Queue, Responsive UI fuer Smartphones).
- `docker-compose.yml` – Startet MySQL, Backend, Frontend und einen Caddy-Reverse-Proxy mit HTTPS-Unterstuetzung.
- `deploy/caddy/Caddyfile` – TLS-Konfiguration (`tls internal` nutzt selbstsignierte Zertifikate; fuer echte Domains kann Caddy automatische Zertifikate beziehen).

### Schnellstart lokal (Docker Desktop o.ae.)
```bash
git clone <repo>
cd <repo>
cp .env.example .env
# Optional: Variablen in .env anpassen
docker compose up -d --build
```
- HTTPS Frontend/API: https://localhost (Browser-Warnung wegen selbstsigniertem Zertifikat bestaetigen)
- Datenbank: `localhost:${MYSQL_PORT:-3306}` (Benutzer `${MYSQL_USER}`, Kennwort `${MYSQL_PASSWORD}`)
- Standard-Admin: Benutzer `admin`, Kennwort `ChangeMe123!` (im Backend per Umgebungsvariablen ueberschreibbar)

### NAS/Server-Deployment
1. Repository-Verzeichnis auf die NAS kopieren (z.B. nach `/volume1/docker/kfz-teilelager`).
2. Per Shell in das Verzeichnis wechseln.
3. `.env.example` nach `.env` kopieren und Werte fuer Passwoerter/Ports anpassen.
4. Startskript ausfuehren:
   ```bash
   ./deploy/start.sh
   ```
   Das Skript baut alle Images und startet die Container im Hintergrund.
5. Status pruefen:
   ```bash
   docker compose ps
   docker compose logs -f caddy
   ```

### Wichtige Umgebungsvariablen (`.env`)
- `MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- `BACKEND_JWT_SECRET`, `BACKEND_JWT_EXPIRES_IN`
- `BACKEND_DB_SYNCHRONIZE` (`true` nur fuer Entwicklung; in Produktion besser `false` und Migrationen einsetzen)
- `CADDY_HTTP_PORT`, `CADDY_HTTPS_PORT`
- Web Push (Hintergrund-Push aufs Handy): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (z.B. `mailto:admin@example.com`)

### Backup-Verzeichnis
Automatische Backups werden im Verzeichnis `./backups` gespeichert (auf dem Host-System).
- Dieses Verzeichnis ist als Bind-Mount im Backend-Container unter `/app/backups` verfügbar
- Backups können direkt auf dem NAS-Dateisystem gesichert/kopiert werden
- Um einen anderen Pfad zu verwenden, passen Sie in `docker-compose.yml` den Volume-Eintrag an:
  ```yaml
  volumes:
    - /mein/backup/pfad:/app/backups
  ```

### Bestell-PDF Archiv
Bestell-PDFs werden persistent im Host-Verzeichnis `./purchase-orders` gespeichert.
- Im Container liegt das Archiv unter `/app/purchase-orders/<jahr>/...`
- Der Pfad kann über `PURCHASE_ORDER_STORAGE_HOST_PATH` in `.env` angepasst werden
- Die UI bietet unter `Bestellungen -> Dokumente` einen direkten Download-Zugriff auf diese Dateien

### Healthchecks
Alle Services besitzen Healthchecks. Docker Compose startet abhängige Container erst, wenn der jeweilige Dienst als gesund markiert ist. Faellt ein Service aus, versucht Compose ihn automatisch neu zu starten.

### Entwicklung (optional)
1. Node.js 20 installieren.
2. `cd backend && npm install` sowie `cd frontend && npm install`.
3. Backend: `npm run start:dev`, Frontend: `npm run dev`.
4. Vorderseite per http://localhost:5173 aufrufen (QR-Scanner erfordert HTTPS fuer echte Kamera-Tests).

### Funktionale Highlights
- Artikel- und Fahrzeugverwaltung (Anlegen, Bearbeiten, Loeschen) mit QR-Scanner und Autocomplete-Feldern.
- Offlinefaehige Buchungs-App inklusive Sync-Endpunkt.
- Inventur-Modul, Bewegungsjournal und Berichte.
- Firmendaten (Name & Logo) im Einstellungsbereich pflegbar; erscheinen auf Login-Seite und Inventur-PDF.
- Inventur-PDF Export mit sortierter Artikelliste (Hersteller/Warengruppe) und technikerfreundlicher Barcodes-Erfassung.
- Standard-Admin wird automatisch erzeugt, solange dieser Benutzer nicht existiert.

### Hinweise fuer Produktion
- Bei Einsatz in produktiven Netzen Caddy mit eigener Domain und gueltigem TLS-Zertifikat betreiben (z.B. `CADDY_TLS_DIRECTIVE="tls admin@example.com"` im Caddyfile).
- `DB_SYNCHRONIZE` auf `false` stellen und strukturierte Migrationen nutzen.
- Admin-Kennwort nach dem ersten Login aendern.
