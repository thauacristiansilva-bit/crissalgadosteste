$ErrorActionPreference = "Stop"

$root = Get-Location
$migration = Join-Path $root "database\migrations\033_persistent_rate_limit.sql"
$rateFile = Join-Path $root "lib\security\rate-limit.ts"
$tempNode = Join-Path $env:TEMP "saborflow-etapa-13-9.cjs"

if (-not (Test-Path $rateFile)) {
  throw "Execute este script na pasta raiz do SaborFlow."
}

Write-Host "=== ETAPA 13.9 - RATE LIMIT PERSISTENTE ==="
Write-Host ""

$migrationSql = @'
BEGIN;

CREATE TABLE IF NOT EXISTS sf_auth_rate_limits (
  key_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sf_auth_rate_limits_reset_at
  ON sf_auth_rate_limits (reset_at);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'saborflow_rls_app'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON sf_auth_rate_limits
      TO saborflow_rls_app;
  END IF;
END
$$;

COMMIT;
'@

[System.IO.File]::WriteAllText(
  $migration,
  $migrationSql.TrimStart(),
  (New-Object System.Text.UTF8Encoding($false))
)
Write-Host "OK: migration 033 criada"

$rateLimitTs = @'
import { createHash } from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"

type RateBucket = {
  failures: number
  resetAt: number
}

type RateLimitState = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

type PersistedRateBucketRow = {
  failures: number
  reset_at: Date | string
}

declare global {
  // eslint-disable-next-line no-var
  var __saborflowAuthRateBuckets: Map<string, RateBucket> | undefined
  // eslint-disable-next-line no-var
  var __saborflowRateLimitLastCleanupAt: number | undefined
}

const fallbackBuckets =
  globalThis.__saborflowAuthRateBuckets || new Map<string, RateBucket>()

globalThis.__saborflowAuthRateBuckets = fallbackBuckets

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

function keyFor(scope: string, value: string) {
  const digest = createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex")

  return `${scope}:${digest}`
}

function cleanExpiredFallback(now: number) {
  if (fallbackBuckets.size < 500) return

  for (const [key, bucket] of fallbackBuckets) {
    if (bucket.resetAt <= now) {
      fallbackBuckets.delete(key)
    }
  }
}

function fallbackState(
  key: string,
  limit: number,
): RateLimitState {
  const now = Date.now()
  cleanExpiredFallback(now)

  const bucket = fallbackBuckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    if (bucket) {
      fallbackBuckets.delete(key)
    }

    return {
      allowed: true,
      remaining: limit,
      retryAfterSeconds: 0,
    }
  }

  const allowed = bucket.failures < limit

  return {
    allowed,
    remaining: Math.max(0, limit - bucket.failures),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(
          1,
          Math.ceil((bucket.resetAt - now) / 1000),
        ),
  }
}

function registerFallbackFailure(
  key: string,
  windowMs: number,
) {
  const now = Date.now()
  const current = fallbackBuckets.get(key)

  if (!current || current.resetAt <= now) {
    fallbackBuckets.set(key, {
      failures: 1,
      resetAt: now + windowMs,
    })
    return
  }

  fallbackBuckets.set(key, {
    failures: current.failures + 1,
    resetAt: current.resetAt,
  })
}

async function cleanupPersistedBuckets() {
  const now = Date.now()
  const lastCleanup =
    globalThis.__saborflowRateLimitLastCleanupAt || 0

  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return
  }

  globalThis.__saborflowRateLimitLastCleanupAt = now

  await getPostgresPool().query(
    `
      DELETE FROM sf_auth_rate_limits
      WHERE reset_at <= NOW()
    `,
  )
}

function persistedState(
  row: PersistedRateBucketRow | undefined,
  limit: number,
): RateLimitState {
  if (!row) {
    return {
      allowed: true,
      remaining: limit,
      retryAfterSeconds: 0,
    }
  }

  const resetAt = new Date(row.reset_at).getTime()

  if (!Number.isFinite(resetAt) || resetAt <= Date.now()) {
    return {
      allowed: true,
      remaining: limit,
      retryAfterSeconds: 0,
    }
  }

  const failures = Math.max(0, Number(row.failures) || 0)
  const allowed = failures < limit

  return {
    allowed,
    remaining: Math.max(0, limit - failures),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(
          1,
          Math.ceil((resetAt - Date.now()) / 1000),
        ),
  }
}

function stricterState(
  left: RateLimitState,
  right: RateLimitState,
): RateLimitState {
  return {
    allowed: left.allowed && right.allowed,
    remaining: Math.min(left.remaining, right.remaining),
    retryAfterSeconds: Math.max(
      left.retryAfterSeconds,
      right.retryAfterSeconds,
    ),
  }
}

export function authRateLimitKey(
  scope: "ip" | "account",
  value: string,
) {
  return keyFor(scope, value || "unknown")
}

export async function checkAuthRateLimit(
  key: string,
  limit: number,
  _windowMs: number,
): Promise<RateLimitState> {
  const local = fallbackState(key, limit)

  try {
    const result =
      await getPostgresPool().query<PersistedRateBucketRow>(
        `
          SELECT failures, reset_at
          FROM sf_auth_rate_limits
          WHERE key_hash = $1
            AND reset_at > NOW()
          LIMIT 1
        `,
        [key],
      )

    const shared = persistedState(result.rows[0], limit)

    return stricterState(local, shared)
  } catch (error) {
    console.error(
      "Falha ao consultar rate limit persistente; usando protecao local.",
      error,
    )
    return local
  }
}

export async function registerAuthFailure(
  key: string,
  windowMs: number,
) {
  registerFallbackFailure(key, windowMs)

  try {
    await getPostgresPool().query(
      `
        INSERT INTO sf_auth_rate_limits (
          key_hash,
          failures,
          reset_at,
          updated_at
        )
        VALUES (
          $1,
          1,
          NOW() + ($2::double precision * INTERVAL '1 millisecond'),
          NOW()
        )
        ON CONFLICT (key_hash)
        DO UPDATE SET
          failures = CASE
            WHEN sf_auth_rate_limits.reset_at <= NOW()
              THEN 1
            ELSE sf_auth_rate_limits.failures + 1
          END,
          reset_at = CASE
            WHEN sf_auth_rate_limits.reset_at <= NOW()
              THEN NOW() + (
                $2::double precision * INTERVAL '1 millisecond'
              )
            ELSE sf_auth_rate_limits.reset_at
          END,
          updated_at = NOW()
      `,
      [key, windowMs],
    )

    await cleanupPersistedBuckets()
  } catch (error) {
    console.error(
      "Falha ao registrar rate limit persistente; protecao local mantida.",
      error,
    )
  }
}

export async function clearAuthFailures(key: string) {
  fallbackBuckets.delete(key)

  try {
    await getPostgresPool().query(
      `
        DELETE FROM sf_auth_rate_limits
        WHERE key_hash = $1
      `,
      [key],
    )
  } catch (error) {
    console.error(
      "Falha ao limpar rate limit persistente.",
      error,
    )
  }
}
'@

[System.IO.File]::WriteAllText(
  $rateFile,
  $rateLimitTs.TrimStart(),
  (New-Object System.Text.UTF8Encoding($false))
)
Write-Host "OK: rate-limit.ts convertido para PostgreSQL + fallback local"

$nodeScript = @'
const fs = require("fs");
const path = require("path");

const root = path.join(process.cwd(), "app", "api");
const targets = [
  "checkAuthRateLimit",
  "registerAuthFailure",
  "clearAuthFailures",
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
    ) {
      out.push(full);
    }
  }
  return out;
}

let changedFiles = 0;
let replacements = 0;

for (const file of walk(root)) {
  let content = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

  if (!content.includes("@/lib/security/rate-limit")) {
    continue;
  }

  const original = content;

  for (const name of targets) {
    const regex = new RegExp(
      String.raw`(?<!await\s)\b${name}\s*\(`,
      "g",
    );

    content = content.replace(regex, (match) => {
      replacements += 1;
      return "await " + match;
    });
  }

  if (content !== original) {
    fs.writeFileSync(
      file,
      content.replace(/\n+$/, "\n"),
      "utf8",
    );
    changedFiles += 1;
  }
}

console.log(
  `OK: ${replacements} chamada(s) async ajustada(s) em ${changedFiles} arquivo(s).`,
);
'@

[System.IO.File]::WriteAllText(
  $tempNode,
  $nodeScript,
  (New-Object System.Text.UTF8Encoding($false))
)

node $tempNode
$nodeExit = $LASTEXITCODE
Remove-Item $tempNode -Force -ErrorAction SilentlyContinue

if ($nodeExit -ne 0) {
  throw "Falha ao ajustar os endpoints para rate limit assincrono."
}

Write-Host ""
Write-Host "Verificando diff..."
git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check encontrou problema."
}

Write-Host ""
Write-Host "Executando build..."
npm.cmd run build
$buildExit = $LASTEXITCODE

git restore -- next-env.d.ts 2>$null

if ($buildExit -ne 0) {
  throw "BUILD FALHOU. Envie o erro completo para correcao."
}

Write-Host ""
Write-Host "=============================================="
Write-Host "ETAPA 13.9 APLICADA - BUILD APROVADO"
Write-Host "=============================================="
Write-Host "- Migration 033 criada."
Write-Host "- Rate limit compartilhado via PostgreSQL."
Write-Host "- Chaves continuam armazenadas somente como SHA-256."
Write-Host "- Fallback local mantido se o banco ficar indisponivel."
Write-Host "- Endpoints existentes ajustados para chamadas async."
Write-Host "- Ainda falta aplicar a migration 033 no banco."
Write-Host "- Ainda nao foi feito commit nem deploy."
