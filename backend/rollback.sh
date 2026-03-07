#!/usr/bin/env bash
# VexoCrm/backend/rollback.sh
# Rollback to previous Docker image.
# Run from repo root or backend directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Stopping current containers..."
cd "$SCRIPT_DIR"
docker compose -f docker-compose.prod.yml down

echo "==> Reverting to previous commit..."
cd "$REPO_ROOT"
git checkout HEAD~1

echo "==> Rebuilding from previous state..."
cd "$SCRIPT_DIR"
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

echo "==> Waiting for health check..."
sleep 10

if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "==> Rollback successful. Health check passed."
else
    echo "==> WARNING: Rollback health check failed. Check logs:"
    docker compose -f docker-compose.prod.yml logs --tail=50
    exit 1
fi
