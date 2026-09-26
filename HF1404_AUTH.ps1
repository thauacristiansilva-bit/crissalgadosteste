$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== HOTFIX 14.4 - AUTORIZACAO IA / RLS ==="
Write-Host ""

$file = "app\api\admin\ai\chat\route.ts"

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

if (-not (Test-Path $file)) {
  throw "Arquivo nao encontrado: $file"
}

$content = [System.IO.File]::ReadAllText($file)

# Adiciona o mesmo wrapper RLS usado pela rota /api/settings.
if ($content -notmatch 'runWithTenantRlsScope') {
  $anchor = @'
import {
  getPostgresPool,
} from "@/lib/postgres"
'@

  $replacement = @'
import {
  getPostgresPool,
} from "@/lib/postgres"
import {
  runWithTenantRlsScope,
} from "@/lib/rls-context"
'@

  if (-not $content.Contains($anchor)) {
    throw "Nao encontrei o ponto de importacao esperado em chat/route.ts."
  }

  $content = $content.Replace($anchor, $replacement)
}

$old = @'
async function tenantAiContext() {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    session.mode !== "tenant"
  ) {
    return null
  }

  const settings =
    await getTenantSettings(
      session.organizationId,
    )

  if (!settings) {
    return null
  }

  const timeZone =
    settings.timeZone ||
    "America/Sao_Paulo"

  const localDate =
    zonedDateString(
      new Date(),
      timeZone,
    )

  return {
    session,
    settings,
    timeZone,
    periodKey:
      `day:${localDate}`,
  }
}
'@

$new = @'
async function tenantAiContext() {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    session.mode !== "tenant"
  ) {
    return null
  }

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () => {
      const settings =
        await getTenantSettings(
          session.organizationId,
        )

      if (!settings) {
        return null
      }

      const timeZone =
        settings.timeZone ||
        "America/Sao_Paulo"

      const localDate =
        zonedDateString(
          new Date(),
          timeZone,
        )

      return {
        session,
        settings,
        timeZone,
        periodKey:
          `day:${localDate}`,
      }
    },
    "tenant-session",
  )
}
'@

if ($content.Contains($old)) {
  $content = $content.Replace($old, $new)
}
elseif ($content.Contains($new)) {
  Write-Host "O hotfix ja estava aplicado ao tenantAiContext."
}
else {
  throw "Nao encontrei a funcao tenantAiContext no formato esperado. Nenhuma alteracao foi salva."
}

[System.IO.File]::WriteAllText(
  $file,
  $content,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Wrapper RLS aplicado na rota da IA."
Write-Host ""

git diff --check

if ($LASTEXITCODE -ne 0) {
  throw "git diff --check falhou."
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

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
Write-Host "HOTFIX 14.4 AUTH IA - BUILD OK"
Write-Host ""
