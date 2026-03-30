# E2E Core Workflows

Diese Suite testet die Kernprozesse Ende-zu-Ende gegen eine laufende API:

- Wareneingang (Teil- und Vollbuchung auf Bestellung)
- Restock/Lagerbereitstellung
- Abholung/Einbuchung auf Fahrzeug

## Start

1. Backend + Datenbank starten (z. B. Docker Compose).
2. Test-User mit Manager-Rechten bereitstellen.
3. Umgebungsvariablen setzen:
   - `E2E_BASE_URL` (optional, Default: `http://localhost:3000/api`)
   - `E2E_USERNAME` (Pflicht)
   - `E2E_PASSWORD` (Pflicht)
4. Test ausführen:

```bash
npm run test:e2e
```

Wenn `E2E_USERNAME`/`E2E_PASSWORD` fehlen, wird die Suite automatisch übersprungen.
