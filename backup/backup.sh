#!/bin/sh
set -eu

require_var() {
  var_name="$1"
  eval "var_value=\${$var_name:-}"
  if [ -z "$var_value" ]; then
    echo "[SaborFlow Backup] ERRO: variavel obrigatoria ausente: $var_name" >&2
    exit 1
  fi
}

require_var DATABASE_URL
require_var AWS_ACCESS_KEY_ID
require_var AWS_SECRET_ACCESS_KEY
require_var ENDPOINT
require_var BUCKET

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
export AWS_REGION="${AWS_REGION:-auto}"

PREFIX="${BACKUP_PREFIX:-saborflow}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
YEAR="$(date -u +%Y)"
MONTH="$(date -u +%m)"
DAY="$(date -u +%d)"
FILE="${PREFIX}-${STAMP}.dump"
SHA_FILE="${FILE}.sha256"
LOCAL_FILE="/tmp/${FILE}"
LOCAL_SHA="/tmp/${SHA_FILE}"
REMOTE_DIR="${PREFIX}/${YEAR}/${MONTH}/${DAY}"
REMOTE_FILE="s3://${BUCKET}/${REMOTE_DIR}/${FILE}"
REMOTE_SHA="s3://${BUCKET}/${REMOTE_DIR}/${SHA_FILE}"

cleanup() {
  rm -f "$LOCAL_FILE" "$LOCAL_SHA"
}
trap cleanup EXIT INT TERM

echo "[SaborFlow Backup] Iniciando backup PostgreSQL em $(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "[SaborFlow Backup] Gerando pg_dump em formato custom..."
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$LOCAL_FILE"

echo "[SaborFlow Backup] Validando estrutura do dump..."
pg_restore --list "$LOCAL_FILE" >/dev/null

echo "[SaborFlow Backup] Gerando SHA-256..."
(
  cd /tmp
  sha256sum "$FILE" > "$SHA_FILE"
)

echo "[SaborFlow Backup] Enviando dump para R2 privado..."
aws s3 cp "$LOCAL_FILE" "$REMOTE_FILE" \
  --endpoint-url "$ENDPOINT" \
  --only-show-errors

echo "[SaborFlow Backup] Enviando checksum..."
aws s3 cp "$LOCAL_SHA" "$REMOTE_SHA" \
  --endpoint-url "$ENDPOINT" \
  --content-type "text/plain" \
  --only-show-errors

echo "[SaborFlow Backup] Confirmando objeto remoto..."
aws s3api head-object \
  --bucket "$BUCKET" \
  --key "${REMOTE_DIR}/${FILE}" \
  --endpoint-url "$ENDPOINT" >/dev/null

BYTES="$(wc -c < "$LOCAL_FILE" | tr -d ' ')"
echo "[SaborFlow Backup] SUCESSO: ${REMOTE_FILE} (${BYTES} bytes)"
echo "[SaborFlow Backup] Finalizado em $(date -u +%Y-%m-%dT%H:%M:%SZ)"
