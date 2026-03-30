# KFZ Teilelager – Architekturüberblick

Dieses Dokument fasst die Architektur des Projekts zusammen: Komponenten, Datenfluss, Rollenmodell und die wichtigsten Geschäftsprozesse (insbesondere Fehlbestände/Nachschub).

## Komponenten

- Backend (NestJS 10, TypeORM, MySQL)
  - Module: auth, email, inventory, items, logging, reports, setup, stock, users, vehicles
  - Global Prefix: `/api`
  - CORS aktiviert, Validierungspipeline aktiv
  - Konfiguration via `.env`/`process.env` (siehe `src/config/configuration.ts`)
- Frontend (React + Vite PWA)
  - Material UI, Zustand Stores, Hooks für Live-Updates/Offline
  - Service Worker/Offline-Queue (IndexedDB via `idb`)
  - API-Client in `src/utils/api.ts` (Basis-URL: `/api`)
- Docker Compose
  - Services: mysql, backend, frontend, caddy (Reverse Proxy/HTTPS)
  - Optional externes Netzwerk (LAN02) im Compose-File konfiguriert

## Domänenmodell (Auszug)

- Items
  - `items` (Artikel-Stammdaten) mit alternativen Codes `item_codes`
- Vehicles
  - `vehicles` (Fahrzeugstammdaten)
- Stock
  - `stock_levels`: Bestand pro (Item, Vehicle), Felder `quantity`, `targetQuantity`
  - `stock_movements`: Bewegungen (CHECKOUT/CHECKIN/ADJUSTMENT) inkl. Metadaten
- Restock/Fehlbestände
  - `restock_requests`: Nachschub-Anfragen, Status: `PENDING`, `APPROVED`, `FULFILLED`, `CANCELLED`
  - Referenzen auf `stockLevel`, `item`, `vehicle`, optional `preparedBy` (User), Zeitstempel `readyAt`/`fulfilledAt`
- Inventory
  - `inventory_sessions`, `inventory_lines` (Inventurprozesse)
- Logging
  - `system_logs`: zentrale Ereignis-/Audit-Logs mit Level/Kategorie, optionale User-/Request-Metadaten

## Rollen & Sicherheit

- Rollen: `TECHNICIAN`, `WAREHOUSE`, `MANAGER`
- Absicherung über `JwtAuthGuard` + `RolesGuard`
- Beispiele:
  - `GET /users` nur für `MANAGER`
  - `stock/*` Endpunkte durch JWT + Rollen abgesichert

## Wichtige Backend-Flows

### Fehlbestände / Nachschub (Restock)

- Ermittlung Bedarf: `StockService.syncRestockRequest(stockLevelId)`
  - Berechnet `shortage = max(0, targetQuantity - quantity)`
  - Legt `restock_requests` an oder aktualisiert diese:
    - `shortage <= 0`: Status → `FULFILLED`, `readyAt/fulfilledAt` setzen
    - `shortage > 0`: Status typ. `PENDING`, `quantityNeeded = shortage`
    - Schutzregeln: `APPROVED`/`CANCELLED` werden nicht überschrieben
- Übersicht Lager: `GET /api/stock/shortages?status=OPEN`
  - Liefert alle offenen Nachschub-Anfragen (≠ `FULFILLED`)
  - Löscht alte `FULFILLED` > 5h (Cleanup)
- Fahrzeug-Fehlbestände: `GET /api/stock/vehicle/:id/shortages`
  - Liefert offene Anfragen für ein Fahrzeug
- Status setzen / Teilmengen bereitstellen: `PATCH /api/stock/shortages/:id`
  - Aktualisiert `status`, `quantityProvided`, ggf. `readyAt/fulfilledAt`
  - Loggt Änderungen via `logging.service`
- WebSocket (Gateway): `restockUpdate`
  - `broadcastRestockUpdate()` sendet neue Übersicht an alle Clients

### Bewegungen (Stock Movements)

- `POST /api/stock/movement`
  - Schreibt `stock_movements`, aktualisiert `stock_levels`
  - Synchronisiert Restock-Requests (`syncRestockRequest`)
  - Validiert Nicht-Negativ-Bestand

### Inventur

- `inventory_sessions` und `inventory_lines` bilden Zählungen & Differenzen ab
- Export/Reports via `reports`-Modul (CSV/PDF-Hooks vorbereitet)

## Frontend-Flows

- Stores (`src/store`): Zustand-Management für Artikel, Fahrzeuge, Nutzer, Nachschub etc.
- Fehlbestände:
  - Lager-Ansicht lädt `fetchRestockOverview({ status: 'OPEN' })`
  - Techniker-Ansicht lädt `fetchVehicleShortages(vehicleId)`
  - Teilmengenbereitstellung setzt `updateRestockStatus()`
  - „Erhalten“ bucht CHECKIN und setzt Status `FULFILLED`
- Live-Update/Polling: `useLiveFleetStock` pollt periodisch; WebSocket-Events werden vom Backend gesendet
- Offline
  - Bewegungen werden bei Fehler/Offline in Queue gelegt (`useOfflineQueue`) und durch `useBackgroundSync` synchronisiert

## Konfiguration

- `.env` bzw. Deployment-Setup:
  - DB-Verbindungsdaten (Host, Port, User, Passwort, DB)
  - `DB_SYNCHRONIZE`, `DB_MIGRATIONS_RUN`
  - JWT-Secret/Expires
  - Ports für Backend/Frontend/Caddy
- Systemweite Einstellungen:
  - `company.name`, `company.logo` werden in `system_config` gespeichert und können im Einstellungsbereich gepflegt werden (Logo erscheint auf Login-Seite und Inventur-PDFs).

## Besonderheiten & Best Practices

- Schutz der manuellen Statuslogik: `APPROVED`/`CANCELLED` werden bei Synchronisation nicht überschrieben
- Cleanup alter `FULFILLED`-Requests (>5h) sorgt für schlanke Übersichten
- `stock_levels` sind per Kombination (Item, Vehicle) eindeutig (`@Unique`)
- Diagnose-/Reparaturroutinen für doppelte `stock_levels` vorhanden (`diagnoseStockLevels`, `repairDuplicateStockLevels`)

## Nützliche Startpunkte im Code

- Backend Einstieg: `src/main.ts`, `src/app.module.ts`
- Restock-Logik: `src/modules/stock/stock.service.ts`
- REST-API für Bestand/Nachschub: `src/modules/stock/stock.controller.ts`
- WebSocket: `src/modules/stock/stock.gateway.ts`
- Frontend API-Client: `frontend/src/utils/api.ts`
- Lager-Dashboard: `frontend/src/pages/DashboardPage.tsx`
