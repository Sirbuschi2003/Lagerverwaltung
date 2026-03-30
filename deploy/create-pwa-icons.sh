#!/bin/bash

# PWA Icon Generator für KFZ Teilelager
# Erstelle einfache Icons falls die aktuellen nicht korrekt sind

echo "Generiere PWA Icons..."

# Simple SVG Icon für KFZ Teilelager
cat > /tmp/kfz-icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ff6b00"/>
  <rect x="64" y="128" width="384" height="256" rx="32" fill="white"/>
  <text x="256" y="200" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#ff6b00">KFZ</text>
  <text x="256" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="normal" fill="#666">TEILE</text>
  <text x="256" y="290" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="normal" fill="#666">LAGER</text>
  <circle cx="150" cy="350" r="30" fill="#ff6b00"/>
  <circle cx="362" cy="350" r="30" fill="#ff6b00"/>
  <rect x="120" y="320" width="272" height="20" fill="#ff6b00"/>
</svg>
EOF

# Konvertiere zu PNG falls ImageMagick/rsvg verfügbar
if command -v convert >/dev/null 2>&1; then
    echo "Erstelle 192x192 Icon..."
    convert /tmp/kfz-icon.svg -resize 192x192 ./frontend/public/pwa-192x192.png
    echo "Erstelle 512x512 Icon..."  
    convert /tmp/kfz-icon.svg -resize 512x512 ./frontend/public/pwa-512x512.png
    echo "Icons erfolgreich erstellt!"
elif command -v rsvg-convert >/dev/null 2>&1; then
    echo "Erstelle 192x192 Icon..."
    rsvg-convert -w 192 -h 192 /tmp/kfz-icon.svg > ./frontend/public/pwa-192x192.png
    echo "Erstelle 512x512 Icon..."
    rsvg-convert -w 512 -h 512 /tmp/kfz-icon.svg > ./frontend/public/pwa-512x512.png
    echo "Icons erfolgreich erstellt!"
else
    echo "WARNUNG: ImageMagick oder rsvg-convert nicht gefunden."
    echo "SVG Icon erstellt in: /tmp/kfz-icon.svg"
    echo "Manuell zu PNG konvertieren oder bestehende Icons prüfen."
fi

echo "PWA Icon Generation abgeschlossen."