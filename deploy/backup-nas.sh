#!/bin/bash
# Lagerverwaltung - NAS Backup Script
# Sichert MySQL-Datenbank + alle Docker-Volumes + Compose-/Env-Konfiguration,
# damit ein Update jederzeit rueckgaengig gemacht werden kann.
#
# Aufruf auf der NAS (im Projektverzeichnis, das docker-compose.main.yml enthaelt):
#   sudo ./deploy/backup-nas.sh
#
# Optional: eigenes Backup-Zielverzeichnis angeben (Standard: ./nas-backups)
#   sudo ./deploy/backup-nas.sh /volume1/docker/Lagerverwaltung-backups

set -euo pipefail

COMPOSE_FILE="docker-compose.main.yml"
COMPOSE="docker compose -f $COMPOSE_FILE"

# Projektverzeichnis (Datei liegt in deploy/, Projekt-Root ist eine Ebene hoeher)
cd "$(dirname "$0")/.."

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Fehler: $COMPOSE_FILE nicht gefunden. Bitte Script aus dem Projektverzeichnis heraus ausfuehren."
  exit 1
fi

if [ ! -f .env ]; then
  echo "Fehler: .env Datei fehlt."
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Hinweis: Auf dieser NAS braucht Docker sudo-Rechte. Bitte mit 'sudo $0' erneut ausfuehren."
  exit 1
fi

# .env laden, um DB-Zugangsdaten zu bekommen
set -a
source .env
set +a

TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_ROOT="${1:-$(pwd)/nas-backups}"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

echo "Lagerverwaltung NAS-Backup"
echo "=========================="
echo "Ziel: $BACKUP_DIR"
echo ""

# --- 1. Aktuell laufende Image-Versionen dokumentieren (fuer gezielten Rollback) ---
echo "1/4 Sichere aktuelle Image-Versionen..."
{
  echo "Backup erstellt am: $(date)"
  echo ""
  $COMPOSE images
} > "$BACKUP_DIR/image-versions.txt"

# --- 2. Compose-Datei + .env sichern (enthaelt Secrets, bleibt nur lokal auf der NAS!) ---
echo "2/4 Sichere Compose-Datei und .env..."
cp "$COMPOSE_FILE" "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/"

# --- 3. MySQL-Datenbank per mysqldump sichern ---
echo "3/4 Sichere Datenbank ($MYSQL_DATABASE)..."
MYSQL_CONTAINER="$($COMPOSE ps -q mysql)"
if [ -z "$MYSQL_CONTAINER" ]; then
  echo "Warnung: MySQL-Container laeuft nicht, ueberspringe Datenbank-Dump."
else
  docker exec "$MYSQL_CONTAINER" \
    mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --all-databases \
    | gzip > "$BACKUP_DIR/mysql-dump.sql.gz"
  echo "   Datenbank-Dump: $(du -h "$BACKUP_DIR/mysql-dump.sql.gz" | cut -f1)"
fi

# --- 4. Alle Docker-Volumes sichern, die zum Projekt gehoeren ---
# Primaerquelle: docker volume ls per Compose-Projekt-Label (funktioniert unabhaengig
# vom Container-Zustand). Zusaetzlich einzeln pro Container inspizieren, statt alle IDs
# in einem einzigen "docker inspect"-Aufruf zu buendeln - sonst liefert EIN abgestuerzter/
# neu erstellter Container (z.B. backend im Restart-Loop) fuer ALLE Container keine Ausgabe.
echo "4/4 Sichere Docker-Volumes..."
PROJECT_NAME="$($COMPOSE config 2>/dev/null | grep -m1 '^name:' | awk '{print $2}')"
PROJECT_NAME="${PROJECT_NAME:-lagerverwaltung}"

VOLUMES_FROM_LABEL="$(docker volume ls --filter "label=com.docker.compose.project=$PROJECT_NAME" --format '{{ .Name }}' 2>/dev/null || true)"

VOLUMES_FROM_CONTAINERS=""
for CID in $($COMPOSE ps -aq); do
  V="$(docker inspect --format '{{ range .Mounts }}{{ if eq .Type "volume" }}{{ .Name }}{{ "\n" }}{{ end }}{{ end }}' "$CID" 2>/dev/null || true)"
  VOLUMES_FROM_CONTAINERS="$(printf '%s\n%s\n' "$VOLUMES_FROM_CONTAINERS" "$V")"
done

VOLUMES="$(printf '%s\n%s\n' "$VOLUMES_FROM_LABEL" "$VOLUMES_FROM_CONTAINERS" | sed '/^$/d' | sort -u)"

if [ -z "$VOLUMES" ]; then
  echo "   Keine benannten Volumes gefunden."
else
  for VOLUME in $VOLUMES; do
    echo "   -> $VOLUME"
    docker run --rm \
      -v "$VOLUME":/data:ro \
      -v "$BACKUP_DIR":/backup \
      alpine \
      tar czf "/backup/volume_${VOLUME}.tar.gz" -C /data .
  done
fi

echo ""
echo "Backup abgeschlossen: $BACKUP_DIR"
echo ""
echo "Rueckrollen (Beispiel):"
echo "  1. Alte Image-Version aus $BACKUP_DIR/image-versions.txt in $COMPOSE_FILE eintragen"
echo "  2. sudo $COMPOSE pull && sudo $COMPOSE up -d"
echo "  3. Nur falls sich das Datenbankschema geaendert hat, zusaetzlich wiederherstellen:"
echo "     gunzip -c $BACKUP_DIR/mysql-dump.sql.gz | docker exec -i \$($COMPOSE ps -q mysql) mysql -u root -p\"\$MYSQL_ROOT_PASSWORD\""
echo ""

# --- Alte Backups aufraeumen (Standard: 14 Tage aufheben) ---
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
echo "Entferne Backups aelter als $RETENTION_DAYS Tage aus $BACKUP_ROOT..."
find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} \;

echo "Fertig."
