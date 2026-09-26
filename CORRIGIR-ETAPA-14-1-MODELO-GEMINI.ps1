$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== HOTFIX ETAPA 14.1 - ATUALIZAR MODELO GEMINI ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

$file = "lib\ai\gemini.ts"

if (-not (Test-Path $file)) {
  throw "Arquivo $file nao encontrado."
}

$content = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $file))

$old = "gemini-2.5-flash-lite"
$new = "gemini-3.5-flash-lite"

if (-not $content.Contains($old)) {
  throw "O modelo antigo '$old' nao foi encontrado em $file."
}

$content = $content.Replace($old, $new)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) $file),
  $content,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Modelo atualizado:"
Write-Host "  $old -> $new"
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
Write-Host "HOTFIX GEMINI APROVADO - BUILD OK"
Write-Host ""
