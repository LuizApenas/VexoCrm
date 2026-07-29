#!/usr/bin/env bash
#
# Recuperação dos dados do módulo Geração Digital: banco ANTIGO -> banco NOVO.
#
# Por que existe: a migração feita via cópia linha-a-linha em JS
# (ensureGdTablesAndSeeds em geracaoDigitalRoutes.js) engolia todos os erros com
# .catch(() => {}), então linhas com qualquer divergência de coluna falhavam em
# SILÊNCIO. Este script usa pg_dump --data-only, que falha ALTO e mostra o motivo
# real de cada linha recusada.
#
# ONDE RODAR: numa máquina que alcança OS DOIS bancos. O banco novo
# (187.77.52.167) está bloqueado para a internet, então rode isto DENTRO do
# Easypanel (terminal do container bk-vexo) ou na VPS, NÃO na sua máquina.
#
# Não apaga nada no destino: usa --data-only e as tabelas já existem lá.
# Conflitos de PK são ignorados (linhas que já existem ficam como estão).
#
# Uso:
#   OLD_DB_URL="postgresql://usuario:senha@host:5432/vexo?sslmode=disable" \
#   NEW_DB_URL="postgresql://usuario:senha@host:5432/vexo-data?sslmode=disable" \
#   bash scripts/recover-gd-data.sh
#
set -uo pipefail

: "${OLD_DB_URL:?Defina OLD_DB_URL com a string do banco ANTIGO (origem)}"
: "${NEW_DB_URL:?Defina NEW_DB_URL com a string do banco NOVO (destino)}"

# Tabelas do módulo GD que guardam dados do cliente. Ordem respeita dependências
# leves; ON CONFLICT/erros de FK são tolerados por tabela.
TABELAS=(
  geracao_digital_briefings
  gd_segments
  gd_products
  vexo_products
  gd_packages
  gd_payment_terms
  gd_presentations
  gd_proposals
  gd_contracts
  gd_contract_templates
  gd_implementation_briefings
  gd_negotiation_scenarios
)

TMP="$(mktemp -d)"
echo "Dump temporário em: $TMP"
echo

for t in "${TABELAS[@]}"; do
  echo "──────────────────────────────────────────"
  echo "Tabela: $t"

  # A tabela existe na origem?
  existe=$(psql "$OLD_DB_URL" -tAc \
    "SELECT to_regclass('public.$t') IS NOT NULL;" 2>/dev/null)
  if [ "$existe" != "t" ]; then
    echo "  · não existe na origem — pulando."
    continue
  fi

  origem=$(psql "$OLD_DB_URL" -tAc "SELECT count(*) FROM public.\"$t\";" 2>/dev/null || echo "?")
  echo "  · origem: $origem linha(s)"

  # Dump SÓ dos dados, com --column-inserts para tolerar divergência de ORDEM de
  # colunas entre os dois bancos (cada INSERT nomeia as colunas).
  pg_dump "$OLD_DB_URL" \
    --data-only --no-owner --no-privileges --column-inserts \
    --table="public.$t" -f "$TMP/$t.sql" 2>"$TMP/$t.dumperr"
  if [ $? -ne 0 ]; then
    echo "  ✗ falha no pg_dump:"; sed 's/^/      /' "$TMP/$t.dumperr"; continue
  fi

  # ON CONFLICT: pg_dump não gera isso. Para não abortar em PK duplicada, roda
  # cada INSERT de forma tolerante (ON_ERROR_ROLLBACK). Linhas novas entram;
  # duplicadas e divergentes são reportadas, sem derrubar o resto.
  psql "$NEW_DB_URL" -v ON_ERROR_ROLLBACK=on -q -f "$TMP/$t.sql" 2>"$TMP/$t.loaderr"
  destino=$(psql "$NEW_DB_URL" -tAc "SELECT count(*) FROM public.\"$t\";" 2>/dev/null || echo "?")
  echo "  · destino agora: $destino linha(s)"
  if [ -s "$TMP/$t.loaderr" ]; then
    echo "  ⚠ avisos ao inserir (as linhas que falharam aparecem aqui):"
    sed 's/^/      /' "$TMP/$t.loaderr" | head -20
  fi
done

echo
echo "──────────────────────────────────────────"
echo "Concluído. Confira as contagens 'destino agora' acima."
echo "Nada foi apagado no banco novo; só inserções foram tentadas."
rm -rf "$TMP"
