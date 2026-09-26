$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host ""
Write-Host "SaborFlow - Hotfix lista de sessoes" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".\lib\security\admin-sessions.ts")) {
    throw "Arquivo lib\security\admin-sessions.ts nao encontrado."
}

$path = ".\lib\security\admin-sessions.ts"
$content = Get-Content $path -Raw

$old = "o.name AS organization_name,"
$new = "o.trade_name AS organization_name,"

if (-not $content.Contains($old)) {
    if ($content.Contains($new)) {
        Write-Host "Correcao ja estava aplicada." -ForegroundColor Yellow
    } else {
        throw "Trecho esperado nao encontrado. Nada foi alterado."
    }
} else {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backup = Join-Path $env:TEMP "SaborFlow-Hotfix13-6-Sessions-$timestamp.ts"
    Copy-Item $path $backup -Force

    $content = $content.Replace($old, $new)

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $fullPath = [System.IO.Path]::GetFullPath($path)
    [System.IO.File]::WriteAllText($fullPath, $content, $utf8NoBom)

    Write-Host "Corrigido: lib\security\admin-sessions.ts" -ForegroundColor Green
    Write-Host "Backup: $backup" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Verificando Git..." -ForegroundColor Cyan
git diff --check
if ($LASTEXITCODE -ne 0) {
    throw "git diff --check encontrou problema."
}

Write-Host ""
Write-Host "Executando build..." -ForegroundColor Cyan
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    throw "Build falhou. Nao faca commit."
}

Write-Host ""
Write-Host "HOTFIX OK - BUILD APROVADO." -ForegroundColor Green
Write-Host ""
