#!/bin/bash

# Caddy Root-CA für Android-Installation extrahieren
echo "Suche nach Caddy Root-CA..."

# Caddy Container finden
CADDY_CONTAINER=$(docker ps --filter "name=caddy" --format "{{.Names}}" | head -1)

if [ -z "$CADDY_CONTAINER" ]; then
    echo "Caddy Container nicht gefunden!"
    exit 1
fi

echo "Caddy Container gefunden: $CADDY_CONTAINER"

# Root-CA aus Caddy Container kopieren
docker exec $CADDY_CONTAINER find /data/caddy/pki -name "root.crt" | while read cert_path; do
    if [ ! -z "$cert_path" ]; then
        echo "Root-CA gefunden: $cert_path"
        docker cp "$CADDY_CONTAINER:$cert_path" ./caddy-root-ca.crt
        echo "Root-CA gespeichert als: $(pwd)/caddy-root-ca.crt"
        echo ""
        echo "ANDROID INSTALLATION:"
        echo "1. caddy-root-ca.crt auf Android-Gerät übertragen"
        echo "2. Einstellungen > Sicherheit > Verschlüsselung > Von Gerätespeicher installieren"
        echo "3. Zertifikat auswählen und als 'CA-Zertifikat' installieren"
        echo "4. Name: 'Caddy Local CA' oder ähnlich"
        echo ""
        break
    fi
done