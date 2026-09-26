$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$path = ".\app\login\page.tsx"

if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Arquivo nao encontrado: $path"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $env:TEMP "SaborFlow-Etapa13-7-login-$stamp.tsx"
Copy-Item -LiteralPath $path -Destination $backup -Force

$utf8 = New-Object System.Text.UTF8Encoding($false)
$full = [System.IO.Path]::GetFullPath($path)
$content = [System.IO.File]::ReadAllText($full, $utf8)

$oldImport = 'import { isAdminAuthenticated } from "@/lib/auth"'
$newImport = 'import { getVerifiedTenantSession } from "@/lib/tenant-access"'

if ($content.Contains($oldImport)) {
    $content = $content.Replace($oldImport, $newImport)
} elseif (-not $content.Contains($newImport)) {
    throw "Nao encontrei o import esperado em app\login\page.tsx"
}

$oldCheck = 'if (await isAdminAuthenticated()) redirect("/admin")'
$newCheck = 'if (await getVerifiedTenantSession()) redirect("/admin")'

if ($content.Contains($oldCheck)) {
    $content = $content.Replace($oldCheck, $newCheck)
} elseif (-not $content.Contains($newCheck)) {
    throw "Nao encontrei a verificacao esperada em app\login\page.tsx"
}

[System.IO.File]::WriteAllText($full, $content, $utf8)

Write-Host ""
Write-Host "HOTFIX LOGIN 13.7 APLICADO." -ForegroundColor Green
Write-Host "Backup: $backup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "O servidor dev pode continuar aberto." -ForegroundColor Cyan
Write-Host "Agora abra novamente http://localhost:3000/login" -ForegroundColor Cyan
