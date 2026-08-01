#!/usr/bin/env bash
# scripts/migrate-to-vps.sh
# Script auxiliar de migracao automatizada para a nova VPS do Conrado
# Uso: bash scripts/migrate-to-vps.sh

set -euo pipefail

echo "======================================================="
echo "   VEXO CRM - AUXILIAR DE MIGRACAO DE INFRAESTRUTURA"
echo "======================================================="

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
DUMP_FILE="${BACKUP_DIR}/vexo_dump_migracao_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[1/4] Verificando conexao com Banco Atual para Backup..."
if [ -n "${OLD_DATABASE_URL:-}" ]; then
    echo "Gerando dump do banco de dados atual..."
    pg_dump "$OLD_DATABASE_URL" -F c -b -v -f "$DUMP_FILE"
    echo "Dump gerado com sucesso em: $DUMP_FILE"
else
    echo "AVISO: Variable OLD_DATABASE_URL nao definida."
    echo "Se voce ja possui um arquivo de dump local em ./vexo-data-20260713.dump, podemos utiliza-lo."
fi

echo ""
echo "[2/4] Instrucoes para Subir a Infraestrutura na VPS:"
echo "-------------------------------------------------------"
echo "1. Envie a pasta do projeto para sua nova VPS via SSH/Git:"
echo "   git clone <URL_DO_SEU_REPOS_OU_ORGANIZATION>"
echo "2. Copie e preencha as variaveis em backend/.env (Firebase, DB_PASSWORD, REDIS_PASSWORD)"
echo "3. Execute o Docker Compose Unificado:"
echo "   docker compose -f ops/docker-compose.full-stack.yml up -d"

echo ""
echo "[3/4] Comando para Restaurar o Dump do Banco na VPS:"
echo "-------------------------------------------------------"
echo "docker exec -i vexo-postgres pg_restore -U vexo_admin -d vexo_db -v < ${DUMP_FILE:-./vexo-data-20260713.dump}"

echo ""
echo "[4/4] Verificacao da Saude do Sistema na VPS:"
echo "-------------------------------------------------------"
echo "curl -sf http://localhost:3001/health || echo 'Backend ainda iniciando...'"
echo "======================================================="
