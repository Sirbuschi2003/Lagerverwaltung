#!/bin/bash
# 🚀 KFZ Teilelager - Universal Docker Installation
# Funktioniert auf jeder Docker-Umgebung (Linux, macOS, Windows WSL)
set -e

echo "🚀 KFZ Teilelager - Universal Docker Setup"
echo "============================================"

# Prüfe Docker Installation
if ! command -v docker &> /dev/null; then
    echo "❌ Docker ist nicht installiert!"
    echo "   Installiere Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Prüfe Docker Compose
if docker compose version &> /dev/null; then
    COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE="docker-compose"
else
    echo "❌ Docker Compose ist nicht verfügbar!"
    echo "   Docker Compose ist seit Docker v20.10 integriert"
    exit 1
fi

echo "✅ Docker gefunden: $(docker --version)"
echo "✅ Compose gefunden: $($COMPOSE version --short 2>/dev/null || echo 'legacy')"

# Gehe zum Projektverzeichnis
cd "$(dirname "$0")/.."
PROJECT_DIR=$(pwd)
echo "📁 Projektverzeichnis: $PROJECT_DIR"

# Umgebungsvariablen prüfen/erstellen
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "📋 Erstelle .env aus .env.example..."
        cp .env.example .env
    else
        echo "📋 Erstelle Standard-.env Datei..."
        cat > .env << 'EOF'
# MySQL Database
MYSQL_ROOT_PASSWORD=secure_root_password_123
MYSQL_DATABASE=kfz_teile
MYSQL_USER=kfz_user
MYSQL_PASSWORD=secure_user_password_123

# Backend JWT
BACKEND_JWT_SECRET=your_very_secure_jwt_secret_key_change_this_in_production_environment

# Optional: Custom Ports (falls 3000/3306 belegt)
# BACKEND_PORT=3000
# MYSQL_PORT=3306
EOF
        echo "⚠️  Standard-.env erstellt - BITTE PASSWÖRTER ÄNDERN!"
    fi
else
    echo "✅ .env bereits vorhanden"
fi

# Frontend Build prüfen
echo ""
echo "🔍 Frontend Build Status..."
if [ -d "frontend/dist" ] && [ "$(ls -A frontend/dist 2>/dev/null)" ]; then
    echo "✅ Frontend Build gefunden"
    BUILD_SIZE=$(du -sh frontend/dist 2>/dev/null | cut -f1)
    echo "   Größe: $BUILD_SIZE"
else
    echo "🔨 Frontend wird gebaut..."
    
    # Prüfe Node.js
    if command -v node &> /dev/null; then
        echo "✅ Node.js gefunden: $(node --version)"
        
        cd frontend
        
        # npm install falls node_modules fehlt
        if [ ! -d "node_modules" ]; then
            echo "📦 Installiere Frontend Dependencies..."
            npm install
        fi
        
        # Build Frontend
        echo "🏗️  Baue Frontend..."
        npm run build
        
        cd ..
        echo "✅ Frontend Build abgeschlossen"
    else
        echo "❌ Node.js nicht gefunden!"
        echo ""
        echo "🔧 LÖSUNG 1 - Lokaler Build:"
        echo "   1. Installiere Node.js: https://nodejs.org/"
        echo "   2. cd frontend && npm install && npm run build"
        echo "   3. Führe dieses Script erneut aus"
        echo ""
        echo "🔧 LÖSUNG 2 - Docker Build:"
        echo "   Das System kann auch ohne lokalen Node.js Build laufen,"
        echo "   ist aber langsamer bei Updates."
        read -p "   Ohne Frontend-Build fortfahren? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# System stoppen falls läuft
echo ""
echo "⏸️  Stoppe eventuelle alte Container..."
$COMPOSE down 2>/dev/null || true

# Docker Images prüfen/bauen
echo ""
echo "🔨 Baue Docker Images..."
$COMPOSE build

# System starten
echo ""
echo "🚀 Starte KFZ Teilelager System..."
$COMPOSE up -d

# Warte auf Services
echo ""
echo "⏳ Warte auf Services..."
sleep 15

# Status prüfen
echo ""
echo "🔍 System Status:"
$COMPOSE ps

# Gesundheitsprüfung
echo ""
echo "🏥 Gesundheitsprüfung..."

# Backend Check
BACKEND_READY=false
for i in {1..30}; do
    if $COMPOSE logs backend 2>/dev/null | grep -q "Nest application successfully started\|Application is running"; then
        BACKEND_READY=true
        break
    fi
    echo -n "."
    sleep 2
done

if [ "$BACKEND_READY" = true ]; then
    echo ""
    echo "✅ Backend ist bereit!"
else
    echo ""
    echo "⚠️  Backend braucht länger zum Starten..."
    echo "📋 Backend Logs (letzte 10 Zeilen):"
    $COMPOSE logs --tail=10 backend
fi

# Netzwerk Info
echo ""
echo "🌐 Netzwerk Informationen:"

# Finde verfügbare Ports
FRONTEND_PORT=$($COMPOSE ps frontend --format "table {{.Ports}}" 2>/dev/null | grep -o '[0-9]\+->80' | cut -d'-' -f1 || echo "5173")
BACKEND_PORT=$($COMPOSE ps backend --format "table {{.Ports}}" 2>/dev/null | grep -o '[0-9]\+->3000' | cut -d'-' -f1 || echo "3000")

# Lokale IP ermitteln
LOCAL_IP=""
if command -v hostname &> /dev/null; then
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
else
    LOCAL_IP="localhost"
fi

echo "   📱 Frontend: http://localhost:${FRONTEND_PORT}"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo "   🌐 Netzwerk: http://${LOCAL_IP}:${FRONTEND_PORT}"
fi

echo ""
echo "🎉 Installation abgeschlossen!"
echo ""
echo "📋 Nächste Schritte:"
echo "   1. Öffne: http://localhost:${FRONTEND_PORT}"
echo "   2. Erstelle deinen Admin-Benutzer beim ersten Besuch"
echo "   3. Lade Artikel-CSV hoch oder erstelle Testdaten"
echo ""
echo "🔧 Verwaltung:"
echo "   Status:     $COMPOSE ps"
echo "   Logs:       $COMPOSE logs -f"
echo "   Stoppen:    $COMPOSE down"
echo "   Neustarten: $COMPOSE restart"
echo ""
echo "📱 PWA Installation:"
echo "   - Chrome: Menü → 'App installieren'"
echo "   - iOS Safari: Teilen → 'Zum Home-Bildschirm'"
echo ""
echo "✅ System läuft erfolgreich!"