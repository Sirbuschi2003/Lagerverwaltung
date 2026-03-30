#!/bin/bash
# KFZ Teilelager - Production Start Script
set -euo pipefail

# Immer die Main-Compose-Datei benutzen (NAS)
COMPOSE="docker compose -f docker-compose.main.yml"

echo "KFZ Teilelager - Produktionsstart"
echo "================================="

# Gehe zum Projektverzeichnis
cd "$(dirname "$0")/.."

# Umgebung prüfen
if [ ! -f .env ]; then
    echo "Fehler: .env Datei fehlt!"
    echo "Bitte .env Datei erstellen oder ./deploy/install.sh ausführen"
    exit 1
fi

# System Status
echo "Aktueller Status:"
$COMPOSE ps 2>/dev/null || echo "   Keine Container laufen"

# Stoppe System
echo ""
echo "Stoppe System..."
$COMPOSE down

# Build und Start
echo ""
echo "Baue und starte System..."
$COMPOSE build --no-cache
$COMPOSE up -d

# Warte auf Services
echo ""
echo "Warte auf Services..."
sleep 20

# Schema-Fix für actualQuantity -> countedQuantity
echo ""
echo "Pruefe Datenbank-Schema..."
if $COMPOSE ps mysql 2>/dev/null | grep -q "Up"; then
    echo "   Repariere actualQuantity -> countedQuantity falls noetig..."
    $COMPOSE exec -T mysql mysql -u root -p${MYSQL_ROOT_PASSWORD:-password} kfz_inventory -e "ALTER TABLE inventory_lines CHANGE actualQuantity countedQuantity int NOT NULL;" \
      2>/dev/null && echo "   Schema korrigiert oder bereits korrekt"
fi

# Status Check
echo ""
echo "System Status:"
$COMPOSE ps

# Backend Health Check
echo ""
echo "Backend Gesundheitspruefung..."
for i in {1..30}; do
    if $COMPOSE logs backend 2>/dev/null | grep -q "Nest application successfully started\\|Application is running"; then
        echo "Backend ist bereit!"
        break
    fi
    echo -n "."
    sleep 2
done

echo ""
echo "System gestartet!"
echo ""
echo "Zugriff:"
echo "  Frontend: https://192.168.3.6/"
echo ""
echo "Verwaltung:"
echo "  Status:     $COMPOSE ps"
echo "  Logs:       $COMPOSE logs -f"
echo "  Stoppen:    $COMPOSE down"
echo "  Neustarten: $COMPOSE restart"
echo ""
echo "System läuft!"
