#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

echo "[deploy] Levantando contenedores con Docker Compose..."
docker compose up -d --build --remove-orphans

echo "[deploy] Esperando a que los servicios estén listos..."
sleep 5

echo "[deploy] Verificando despliegue de producción..."
node ../scripts/verify-production.mjs https://peekrush.inmerzion.io

echo "[deploy] Despliegue completado con éxito en https://peekrush.inmerzion.io"
