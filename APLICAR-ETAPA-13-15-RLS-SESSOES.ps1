$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== ETAPA 13.15 - RLS EM sf_admin_sessions ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

$target = "lib\security\admin-sessions.ts"
if (-not (Test-Path $target)) {
  throw "Arquivo nao encontrado: $target"
}

$text = Get-Content $target -Raw

$importLine = 'import { enterRlsUserContext } from "@/lib/rls-context"'
if ($text -notmatch [regex]::Escape($importLine)) {
  $text = $importLine + "`r`n" + $text
}

function Add-RlsContext {
  param(
    [string]$Text,
    [string]$FunctionName,
    [string]$ContextLine
  )

  $start = $Text.IndexOf("export async function $FunctionName")
  if ($start -lt 0) {
    throw "Funcao nao encontrada: $FunctionName"
  }

  $next = $Text.IndexOf("export async function ", $start + 20)
  if ($next -lt 0) {
    $next = $Text.Length
  }

  $segment = $Text.Substring($start, $next - $start)

  if ($segment.Contains($ContextLine)) {
    return $Text
  }

  $marker = ") {"
  $relative = $segment.IndexOf($marker)
  if ($relative -lt 0) {
    throw "Abertura da funcao nao encontrada: $FunctionName"
  }

  $insertAt = $start + $relative + $marker.Length
  $nl = if ($Text.Contains("`r`n")) { "`r`n" } else { "`n" }

  return $Text.Insert(
    $insertAt,
    $nl + "  " + $ContextLine + $nl
  )
}

$text = Add-RlsContext $text "createAdminSessionRecord" "enterRlsUserContext(input.userId)"
$text = Add-RlsContext $text "validateAndTouchAdminSession" "enterRlsUserContext(input.userId)"
$text = Add-RlsContext $text "listAdminSessions" "enterRlsUserContext(userId)"
$text = Add-RlsContext $text "moveAdminSessionToOrganization" "enterRlsUserContext(input.userId)"
$text = Add-RlsContext $text "revokeAdminSession" "enterRlsUserContext(input.userId)"
$text = Add-RlsContext $text "revokeOtherAdminSessions" "enterRlsUserContext(userId)"
$text = Add-RlsContext $text "revokeAllAdminSessionsForUser" "enterRlsUserContext(userId)"

Set-Content -Path $target -Value $text -Encoding UTF8

$migration = "database\migrations\035_admin_sessions_rls.sql"

@'
BEGIN;

ALTER TABLE sf_admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_admin_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sf_admin_sessions_user_guard
  ON sf_admin_sessions;

CREATE POLICY sf_admin_sessions_user_guard
ON sf_admin_sessions
FOR ALL
USING (
  sf_rls_bypass_enabled()
  OR user_id = sf_current_user_id()
)
WITH CHECK (
  sf_rls_bypass_enabled()
  OR user_id = sf_current_user_id()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'saborflow_rls_app'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON sf_admin_sessions
      TO saborflow_rls_app;
  END IF;
END
$$;

INSERT INTO sf_schema_migrations (version)
VALUES ('035_admin_sessions_rls')
ON CONFLICT (version) DO NOTHING;

COMMIT;
'@ | Set-Content -Path $migration -Encoding UTF8

Write-Host ""
Write-Host "Arquivos preparados:"
Write-Host "  - $target"
Write-Host "  - $migration"
Write-Host ""

git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check falhou."
}

npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) {
  throw "typecheck falhou."
}

npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  throw "build falhou."
}

git restore -- next-env.d.ts 2>$null

Write-Host ""
Write-Host "ETAPA 13.15 RLS DE SESSOES PREPARADA - BUILD APROVADO"
Write-Host ""
