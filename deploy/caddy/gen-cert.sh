#!/bin/sh
# =============================================================
# Lagerverwaltung – Einmaliges Zertifikat generieren
# Ausfuehren auf der NAS (einmalig!):
#
#   cd /volume1/docker/Lagerverwaltung
#   sh deploy/caddy/gen-cert.sh
#
# Danach: server.crt auf allen Geraeten als vertrauenswuerdig
# installieren. Das Zertifikat ist 10 Jahre gueltig und aendert
# sich NIE mehr (solange du gen-cert.sh nicht erneut ausfuehrst).
# =============================================================

set -e

# IP aus .env lesen, Fallback auf Standard-IP
if [ -f ".env" ]; then
  APP_HOST=$(grep '^APP_HOST=' .env | cut -d'=' -f2 | tr -d '[:space:]')
fi
APP_HOST="${APP_HOST:-192.168.3.15}"

OUT_DIR="deploy/caddy"

echo "================================================="
echo "  Lagerverwaltung – Zertifikat generieren"
echo "  IP-Adresse: ${APP_HOST}"
echo "  Gueltig:    10 Jahre"
echo "================================================="

# Pruefe ob openssl verfuegbar ist
if ! command -v openssl >/dev/null 2>&1; then
  echo "FEHLER: openssl ist nicht installiert."
  echo "Auf Synology: sudo opkg install openssl-util"
  echo "Auf UGreen:   Ist normalerweise vorinstalliert"
  exit 1
fi

# OpenSSL-Konfiguration fuer maximale Geraetekompatibilitaet
# (iOS, Android, Chrome, Firefox, Windows, macOS)
cat > /tmp/lager-cert.cnf << EOF
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
x509_extensions    = v3_ca

[dn]
C  = DE
O  = Lagerverwaltung
CN = ${APP_HOST}

[v3_ca]
subjectAltName      = IP:${APP_HOST}
keyUsage            = critical, digitalSignature, keyEncipherment
extendedKeyUsage    = serverAuth
basicConstraints    = critical, CA:TRUE
subjectKeyIdentifier = hash
EOF

# Zertifikat generieren
openssl req -x509 \
  -newkey rsa:2048 \
  -keyout "${OUT_DIR}/server.key" \
  -out    "${OUT_DIR}/server.crt" \
  -days   3650 \
  -nodes \
  -config /tmp/lager-cert.cnf

rm -f /tmp/lager-cert.cnf

# Auch als .cer (Windows-kompatibel) und .pem kopieren
cp "${OUT_DIR}/server.crt" "${OUT_DIR}/server.cer"
cp "${OUT_DIR}/server.crt" "${OUT_DIR}/server.pem"

echo ""
echo "================================================="
echo "  Fertig! Zertifikate erstellt:"
echo "  ${OUT_DIR}/server.crt  ← Zertifikat"
echo "  ${OUT_DIR}/server.key  ← Privater Schluessel"
echo "================================================="
echo ""
echo "  Naechster Schritt:"
echo "  server.crt auf jedem Geraet als vertrauenswuerdig"
echo "  installieren (einmalig)."
echo ""
echo "  Download-Link nach dem Start:"
echo "  https://${APP_HOST}/rootCA-local.crt"
echo "================================================="
