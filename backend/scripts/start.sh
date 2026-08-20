#!/bin/sh
set -e

echo "[start] Running database migrations..."
node /app/node_modules/typeorm/cli.js migration:run -d /app/dist/config/data-source.js

echo "[start] Migrations complete. Starting application..."
exec node /app/dist/main.js
