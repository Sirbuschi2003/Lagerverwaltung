@echo off
echo ============================================
echo  Lagerverwaltung - Lokale Entwicklung
echo ============================================
echo.

REM .env fuer Dev anlegen falls nicht vorhanden
if not exist ".env.dev" (
    echo .env.dev nicht gefunden, wird angelegt...
    (
        echo MYSQL_ROOT_PASSWORD=devroot123
        echo MYSQL_DATABASE=lagerverwaltung_dev
        echo MYSQL_USER=lagerverwaltung
        echo MYSQL_PASSWORD=lagerverwaltung_dev
        echo MYSQL_PORT=3308
        echo BACKEND_PORT=3002
        echo PHPMYADMIN_PORT=8082
        echo CADDY_HTTP_PORT=8080
        echo CADDY_HTTPS_PORT=8443
        echo BACKEND_JWT_SECRET=dev-secret-key-nur-fuer-lokale-entwicklung
        echo BACKEND_JWT_EXPIRES_IN=8h
        echo BACKEND_JWT_REFRESH_EXPIRES_IN=30d
        echo INVENTORY_HMAC_SECRET=dev-hmac-secret-nur-fuer-lokale-entwicklung-32z
        echo PURCHASE_ORDER_STORAGE_HOST_PATH=./purchase-orders-dev
        echo ITEM_IMAGE_STORAGE_HOST_PATH=./item-images-dev
    ) > .env.dev
    echo .env.dev erstellt.
    echo.
)

echo Starte Docker-Container...
echo URL: https://localhost:8443
echo phpMyAdmin: http://localhost:8082
echo.

docker compose -f docker-compose.dev.yml --env-file .env.dev up --build

pause
