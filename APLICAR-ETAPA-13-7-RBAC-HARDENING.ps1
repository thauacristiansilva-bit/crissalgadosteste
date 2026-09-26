$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host ""
Write-Host "SaborFlow - Etapa 13.7 - RBAC Hardening" -ForegroundColor Cyan
Write-Host ""

$targets = @(
  "app\admin\page.tsx",
  "app\admin\nova-empresa\page.tsx",
  "app\api\admin\tenant-context\route.ts",
  "app\api\admin\rbac-health\route.ts",
  "app\api\admin\rls-health\route.ts",
  "app\api\admin\phase25-6-health\route.ts",
  "app\api\admin\tenant-runtime-health\route.ts",
  "app\api\admin\operations-health\route.ts",
  "app\api\admin\orders-health\route.ts",
  "app\api\admin\catalog-health\route.ts",
  "app\api\admin\customers-health\route.ts"
)

foreach ($file in $targets) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw "Arquivo obrigatorio nao encontrado: $file"
  }
}

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Utf8([string]$path) {
  $full = [System.IO.Path]::GetFullPath($path)
  return [System.IO.File]::ReadAllText($full, $utf8)
}

function Write-Utf8([string]$path, [string]$content) {
  $full = [System.IO.Path]::GetFullPath($path)
  [System.IO.File]::WriteAllText($full, $content, $utf8)
}

function Replace-Exact(
  [string]$path,
  [string]$old,
  [string]$new,
  [string]$label
) {
  $content = Read-Utf8 $path

  if ($content.Contains($new)) {
    Write-Host "OK ja aplicado: $label" -ForegroundColor DarkYellow
    return
  }

  if (-not $content.Contains($old)) {
    throw "Nao encontrei o trecho esperado para: $label em $path. Nada adicional foi alterado."
  }

  $content = $content.Replace($old, $new)
  Write-Utf8 $path $content
  Write-Host "Aplicado: $label" -ForegroundColor Green
}

function Insert-Before(
  [string]$path,
  [string]$anchor,
  [string]$insert,
  [string]$marker,
  [string]$label
) {
  $content = Read-Utf8 $path

  if ($content.Contains($marker)) {
    Write-Host "OK ja aplicado: $label" -ForegroundColor DarkYellow
    return
  }

  $index = $content.IndexOf($anchor)
  if ($index -lt 0) {
    throw "Ancora nao encontrada para: $label em $path"
  }

  $content = $content.Insert($index, $insert)
  Write-Utf8 $path $content
  Write-Host "Aplicado: $label" -ForegroundColor Green
}

function Replace-RegexRequired(
  [string]$path,
  [string]$pattern,
  [string]$replacement,
  [string]$alreadyMarker,
  [string]$label
) {
  $content = Read-Utf8 $path

  if ($content.Contains($alreadyMarker)) {
    Write-Host "OK ja aplicado: $label" -ForegroundColor DarkYellow
    return
  }

  $regex = New-Object System.Text.RegularExpressions.Regex(
    $pattern,
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )

  if (-not $regex.IsMatch($content)) {
    throw "Padrao nao encontrado para: $label em $path"
  }

  $content = $regex.Replace($content, $replacement, 1)
  Write-Utf8 $path $content
  Write-Host "Aplicado: $label" -ForegroundColor Green
}

# Backup completo dos arquivos que serao alterados.
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $env:TEMP "SaborFlow-Etapa13-7-Backup-$stamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

foreach ($file in $targets) {
  $safe = ($file -replace '[\\/:*?"<>|]', '_')
  Copy-Item -LiteralPath $file -Destination (Join-Path $backupRoot $safe) -Force
}

Write-Host "Backup: $backupRoot" -ForegroundColor DarkGray
Write-Host ""

# 1) /admin precisa validar a sessao persistente da Etapa 13.6 antes de carregar dados.
Replace-Exact `
  "app\admin\page.tsx" `
  'import { getAdminEmail, getAdminSession } from "@/lib/auth"' `
  ('import { getAdminEmail } from "@/lib/auth"' + [Environment]::NewLine + 'import { getVerifiedTenantSession } from "@/lib/tenant-access"') `
  "Admin principal usa sessao tenant verificada"

Replace-Exact `
  "app\admin\page.tsx" `
  'const session = await getAdminSession()' `
  'const session = await getVerifiedTenantSession()' `
  "Admin principal valida registro persistente de sessao"

# 2) Nova empresa: proprietario tambem deve estar com sessao persistente valida.
Replace-Exact `
  "app\admin\nova-empresa\page.tsx" `
  'import { getAdminSession } from "@/lib/auth"' `
  'import { getVerifiedTenantSession } from "@/lib/tenant-access"' `
  "Nova empresa usa sessao verificada"

Replace-Exact `
  "app\admin\nova-empresa\page.tsx" `
  'const session = await getAdminSession()' `
  'const session = await getVerifiedTenantSession()' `
  "Nova empresa valida sessao persistente"

# 3) tenant-context: remove o caminho legado/raw e exige a sessao verificada.
Replace-Exact `
  "app\api\admin\tenant-context\route.ts" `
  ('import {' + [Environment]::NewLine + '  getAdminSession,' + [Environment]::NewLine + '} from "@/lib/auth"' + [Environment]::NewLine) `
  '' `
  "Tenant context remove import de sessao raw"

Replace-RegexRequired `
  "app\api\admin\tenant-context\route.ts" `
  '\s*const rawSession\s*=\s*await getAdminSession\(\).*?const session\s*=\s*await getVerifiedTenantSession\(\)' `
  ([Environment]::NewLine + '  const session =' + [Environment]::NewLine + '    await getVerifiedTenantSession()') `
  'const session =' `
  "Tenant context fecha caminho legado/raw"

# Funcoes de ajuda para endpoints tecnicos.
$securityImport = 'import { canManageSecurity } from "@/lib/admin-access"' + [Environment]::NewLine
$securityGuard = @'
  if (!canManageSecurity(session.role, session.operationalPermissions)) {
    return NextResponse.json(
      { error: "Seu perfil nao pode acessar este diagnostico." },
      { status: 403 },
    )
  }

'@

function Harden-SecurityDiagnostic([string]$path, [string]$anchor) {
  Insert-Before `
    $path `
    'import { NextResponse } from "next/server"' `
    $securityImport `
    'import { canManageSecurity } from "@/lib/admin-access"' `
    "Importa controle security.manage em $path"

  Insert-Before `
    $path `
    $anchor `
    $securityGuard `
    'Seu perfil nao pode acessar este diagnostico.' `
    "Bloqueia diagnostico tecnico sem security.manage em $path"
}

# 4) Diagnosticos tecnicos deixam de ser acessiveis apenas por conhecer a URL.
Harden-SecurityDiagnostic "app\api\admin\rls-health\route.ts" "  try {"
Harden-SecurityDiagnostic "app\api\admin\phase25-6-health\route.ts" "  try {"
Harden-SecurityDiagnostic "app\api\admin\tenant-runtime-health\route.ts" "  try {"
Harden-SecurityDiagnostic "app\api\admin\operations-health\route.ts" "  try {"
Harden-SecurityDiagnostic "app\api\admin\orders-health\route.ts" "  try {"
Harden-SecurityDiagnostic "app\api\admin\catalog-health\route.ts" "  try {"
Harden-SecurityDiagnostic "app\api\admin\customers-health\route.ts" "  try {"

# 5) Diagnostico RBAC exige governanca de acessos.
$rbacPath = "app\api\admin\rbac-health\route.ts"
Insert-Before `
  $rbacPath `
  'import { NextResponse } from "next/server"' `
  ('import { canManageAccess } from "@/lib/tenant-permissions"' + [Environment]::NewLine) `
  'import { canManageAccess } from "@/lib/tenant-permissions"' `
  "RBAC health importa access.manage"

$rbacGuard = @'
  if (!canManageAccess(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil nao pode consultar a governanca de acessos." },
      { status: 403 },
    )
  }

'@

Insert-Before `
  $rbacPath `
  '  const result = await getPostgresPool().query<{' `
  $rbacGuard `
  'Seu perfil nao pode consultar a governanca de acessos.' `
  "RBAC health exige access.manage"

Write-Host ""
Write-Host "Validando alteracoes..." -ForegroundColor Cyan

git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check encontrou problema. Nao faca commit."
}

Write-Host ""
Write-Host "Executando build..." -ForegroundColor Cyan
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  throw "Build falhou. Nao faca commit."
}

Write-Host ""
Write-Host "ETAPA 13.7 APLICADA - BUILD APROVADO." -ForegroundColor Green
Write-Host "Ainda nao foi feito commit nem deploy." -ForegroundColor Yellow
Write-Host ""
