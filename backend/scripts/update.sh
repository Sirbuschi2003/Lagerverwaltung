#!/bin/sh
# =============================================================
# Lagerverwaltung – Update Helper Script
# Laeuft innerhalb eines Sibling-Containers mit Docker-Socket-Zugriff.
# Wird vom Backend automatisch ausgefuehrt wenn ein In-App-Update
# eingespielt wird.
# =============================================================

set -e

PROJECT_PATH="$1"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-lagerverwaltung}"
COMPOSE_FILE="${PROJECT_PATH}/docker-compose.main.yml"

log() { echo "[update] $*"; }

log "================================================="
log "Lagerverwaltung Update Helper gestartet"
log "Pfad:    ${PROJECT_PATH}"
log "Projekt: ${PROJECT_NAME}"
log "Datei:   ${COMPOSE_FILE}"
log "================================================="

# ── Compose-Befehl ermitteln (v2 hat Vorrang) ──────────────────
DC=""
if docker compose version >/dev/null 2>&1; then
    DC="docker compose"
    log "docker compose v2 erkannt"
elif docker-compose --version >/dev/null 2>&1; then
    DC="docker-compose"
    log "docker-compose v1 erkannt"
else
    log "FEHLER: Weder 'docker compose' noch 'docker-compose' verfuegbar!"
    exit 1
fi

# ── Compose-Datei pruefen ─────────────────────────────────────
if [ ! -f "${COMPOSE_FILE}" ]; then
    log "FEHLER: Compose-Datei nicht gefunden: ${COMPOSE_FILE}"
    log "Verzeichnisinhalt:"
    ls -la "${PROJECT_PATH}" 2>/dev/null || log "(Verzeichnis nicht lesbar)"
    exit 1
fi
log "Compose-Datei gefunden."

# ── Container neu starten ─────────────────────────────────────
log "Starte Container neu (--force-recreate --remove-orphans)..."

if ${DC} \
    -p "${PROJECT_NAME}" \
    -f "${COMPOSE_FILE}" \
    --project-directory "${PROJECT_PATH}" \
    up -d \
    --force-recreate \
    --remove-orphans \
    2>&1; then

    log "Alle Container erfolgreich neu gestartet."
else
    EXIT_CODE=$?
    log "FEHLER: 'up -d' schlug fehl (Exit-Code: ${EXIT_CODE})."
    log "Versuche Fallback: direkten 'docker restart' fuer jeden Container..."

    # Fallback: Container einzeln per docker restart neu starten
    # Benennung: <projektname>-<service>-1 (docker compose v2) oder <projektname>_<service>_1 (v1)
    for SERVICE in backend frontend caddy; do
        # Probiere beide Namenskonventionen
        for CNAME in \
            "${PROJECT_NAME}-${SERVICE}-1" \
            "${PROJECT_NAME}_${SERVICE}_1" \
            "lager-${SERVICE}"; do
            if docker inspect "${CNAME}" >/dev/null 2>&1; then
                log "Starte ${CNAME} neu..."
                docker restart "${CNAME}" && break
            fi
        done
    done
    log "Fallback abgeschlossen."
fi

log "================================================="
log "Update Helper fertig."
log "================================================="
