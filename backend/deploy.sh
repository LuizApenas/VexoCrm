#!/usr/bin/env bash
# VexoCrm/backend/deploy.sh
# Quick deploy/update script for VPS.
# Run from repo root or backend directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Pulling latest changes..."
git pull origin main

echo "==> Building and starting containers..."
cd "$SCRIPT_DIR"
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo "==> Waiting for health check..."
sleep 10

if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "==> Health check passed!"
    docker compose -f docker-compose.prod.yml ps
else
    echo "==> Health check FAILED. Rolling back..."
    docker compose -f docker-compose.prod.yml logs --tail=50
    exit 1
fi

echo "==> Deploy complete."
