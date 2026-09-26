$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== HOTFIX 14.5 - FRONTEND UPLOAD DE VIDEO ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

$file = "components\superadmin\help-center-admin-panel.tsx"

if (-not (Test-Path $file)) {
  throw "Arquivo nao encontrado: $file"
}

$content = [System.IO.File]::ReadAllText($file)

# Remove somente a criacao/append do FormData, independentemente da formatacao.
$patternFormData = '(?s)\s*const\s+payload\s*=\s*new\s+FormData\(\)\s*payload\.append\(\s*"file"\s*,\s*videoFile\s*,?\s*\)\s*'

$matchesFormData = [regex]::Matches($content, $patternFormData)

if ($matchesFormData.Count -eq 1) {
  $content = [regex]::Replace(
    $content,
    $patternFormData,
    "`r`n",
    1
  )
}
elseif ($matchesFormData.Count -gt 1) {
  throw "Encontrei mais de um bloco FormData. Nenhuma alteracao foi salva."
}
elseif ($content -match 'new\s+FormData\(\)') {
  throw "Encontrei FormData, mas em formato inesperado. Nenhuma alteracao foi salva."
}

# Troca somente o corpo do fetch do endpoint de video.
$oldBodyPattern = 'body\s*:\s*payload\s*,?'

if ([regex]::IsMatch($content, $oldBodyPattern)) {
  $replacement = @'
headers: {
            "Content-Type":
              videoFile.type,
          },
          body: videoFile,
'@

  $content = [regex]::Replace(
    $content,
    $oldBodyPattern,
    $replacement,
    1
  )
}
elseif ($content -match 'body\s*:\s*videoFile') {
  Write-Host "O frontend ja estava usando corpo binario."
}
else {
  throw "Nao encontrei body: payload no upload de video. Nenhuma alteracao foi salva."
}

[System.IO.File]::WriteAllText(
  $file,
  $content,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Frontend de upload atualizado."
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
Write-Host "HOTFIX 14.5 - FRONTEND VIDEO - BUILD OK"
Write-Host ""
