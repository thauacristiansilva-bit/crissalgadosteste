#!/bin/sh
set -eu

require_var() {
  var_name="$1"
  eval "var_value=\${$var_name:-}"
  if [ -z "$var_value" ]; then
    echo "[SaborFlow Restore] ERRO: variavel obrigatoria ausente: $var_name" >&2
    exit 1
  fi
}

require_var TARGET_DATABASE_URL
require_var AWS_ACCESS_KEY_ID
require_var AWS_SECRET_ACCESS_KEY
require_var ENDPOINT
require_var BUCKET

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
export AWS_REGION="${AWS_REGION:-auto}"

PREFIX="${BACKUP_PREFIX:-saborflow}"

cleanup() {
  rm -f /tmp/saborflow-restore-*.dump /tmp/saborflow-restore-*.sha256 /tmp/*.dump.sha256 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[SaborFlow Restore] Iniciando teste de restauracao em $(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "[SaborFlow Restore] Validando conexao com banco TEMPORARIO..."
TARGET_INFO="$(psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT current_database() || ' | ' || current_user;")"
echo "[SaborFlow Restore] Destino: $TARGET_INFO"

# Protecao: este teste so restaura em banco vazio.
PUBLIC_TABLES="$(psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
if [ "$PUBLIC_TABLES" != "0" ]; then
  echo "[SaborFlow Restore] BLOQUEADO: o banco de destino possui $PUBLIC_TABLES tabela(s) publica(s)." >&2
  echo "[SaborFlow Restore] Por seguranca, este script restaura APENAS em banco vazio." >&2
  exit 2
fi

echo "[SaborFlow Restore] Procurando backup mais recente em s3://${BUCKET}/${PREFIX}/ ..."
LATEST_KEY="$(aws s3 ls "s3://${BUCKET}/${PREFIX}/" --recursive --endpoint-url "$ENDPOINT" | awk '{print $4}' | grep '\.dump$' | sort | tail -n 1 || true)"
if [ -z "$LATEST_KEY" ]; then
  echo "[SaborFlow Restore] ERRO: nenhum arquivo .dump encontrado no bucket/prefixo informado." >&2
  exit 3
fi

FILE="$(basename "$LATEST_KEY")"
LOCAL_FILE="/tmp/saborflow-restore-${FILE}"
SHA_KEY="${LATEST_KEY}.sha256"
LOCAL_SHA="/tmp/${FILE}.sha256"

echo "[SaborFlow Restore] Backup selecionado: s3://${BUCKET}/${LATEST_KEY}"
echo "[SaborFlow Restore] Baixando dump..."
aws s3 cp "s3://${BUCKET}/${LATEST_KEY}" "$LOCAL_FILE" --endpoint-url "$ENDPOINT" --only-show-errors

echo "[SaborFlow Restore] Validando estrutura do arquivo..."
pg_restore --list "$LOCAL_FILE" >/dev/null

if aws s3 cp "s3://${BUCKET}/${SHA_KEY}" "$LOCAL_SHA" --endpoint-url "$ENDPOINT" --only-show-errors 2>/dev/null; then
  EXPECTED="$(awk '{print $1}' "$LOCAL_SHA")"
  ACTUAL="$(sha256sum "$LOCAL_FILE" | awk '{print $1}')"
  if [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "[SaborFlow Restore] ERRO: SHA-256 do dump nao confere." >&2
    exit 4
  fi
  echo "[SaborFlow Restore] SHA-256 confirmado."
else
  echo "[SaborFlow Restore] AVISO: checksum remoto nao encontrado; continuando apos validacao do pg_restore."
fi

echo "[SaborFlow Restore] Restaurando no PostgreSQL TEMPORARIO..."
pg_restore \
  --dbname="$TARGET_DATABASE_URL" \
  --no-owner \
  --no-acl \
  --exit-on-error \
  --single-transaction \
  "$LOCAL_FILE"

echo "[SaborFlow Restore] Atualizando estatisticas do banco temporario..."
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c "ANALYZE;" >/dev/null

RESTORED_TABLES="$(psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
if [ "$RESTORED_TABLES" = "0" ]; then
  echo "[SaborFlow Restore] ERRO: restauracao terminou sem tabelas publicas." >&2
  exit 5
fi

echo "[SaborFlow Restore] Tabelas restauradas: $RESTORED_TABLES"
echo "[SaborFlow Restore] Estimativas de registros nas tabelas principais:"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "
SELECT relname || '=' || GREATEST(reltuples,0)::bigint
FROM pg_class
WHERE relkind='r'
  AND relname IN ('sf_organizations','sf_users','sf_products','sf_orders')
ORDER BY relname;
" | sed 's/^/[SaborFlow Restore]   /'

echo "[SaborFlow Restore] SUCESSO: backup restaurado e validado em banco temporario."
echo "[SaborFlow Restore] Finalizado em $(date -u +%Y-%m-%dT%H:%M:%SZ)"
