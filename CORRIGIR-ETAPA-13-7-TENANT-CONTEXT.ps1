$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$path = ".\app\api\admin\tenant-context\route.ts"

if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Arquivo nao encontrado: $path"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $env:TEMP "SaborFlow-Etapa13-7-tenant-context-$stamp.ts"
Copy-Item -LiteralPath $path -Destination $backup -Force

$content = @'
import { NextResponse } from "next/server"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  listOrganizationMembershipsForUserId,
} from "@/lib/tenant-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sessão administrativa inválida ou expirada.",
      },
      { status: 401 },
    )
  }

  const organizations =
    await listOrganizationMembershipsForUserId(
      session.userId,
    )

  return NextResponse.json({
    ok: true,
    sessionMode: "tenant",
    user: {
      id: session.userId,
      email: session.email,
      role: session.role,
    },
    organization: {
      id:
        session.organizationId,
      name:
        session.organizationName,
      slug:
        session.organizationSlug,
    },
    activeMembership: true,
    organizations:
      organizations.map(
        (organization) => ({
          id:
            organization.organizationId,
          name:
            organization.organizationName,
          slug:
            organization.organizationSlug,
          role:
            organization.role,
          publicOrderingEnabled:
            organization.publicOrderingEnabled,
        }),
      ),
  })
}
'@

$utf8 = New-Object System.Text.UTF8Encoding($false)
$full = [System.IO.Path]::GetFullPath($path)
[System.IO.File]::WriteAllText($full, $content, $utf8)

Write-Host ""
Write-Host "Corrigido: app\api\admin\tenant-context\route.ts" -ForegroundColor Green
Write-Host "Backup: $backup" -ForegroundColor DarkGray
Write-Host ""

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
Write-Host "HOTFIX 13.7 OK - BUILD APROVADO." -ForegroundColor Green
Write-Host ""
