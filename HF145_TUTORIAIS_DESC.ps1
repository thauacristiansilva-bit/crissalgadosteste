$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== HOTFIX 14.5 - DESCRICAO ABA TUTORIAIS ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

$file = "components\superadmin\superadmin-dashboard.tsx"

if (-not (Test-Path $file)) {
  throw "Arquivo nao encontrado: $file"
}

$content = [System.IO.File]::ReadAllText($file)

$line = '  "Tutoriais": "Central de Ajuda, documentação e vídeos de treinamento do SaborFlow.",'

if ($content.Contains($line)) {
  Write-Host "A descricao da aba Tutoriais ja existe."
}
else {
  $anchor = '  "Domínios": "Domínios das empresas e situação de verificação.",'

  if (-not $content.Contains($anchor)) {
    throw "Nao encontrei o ponto de tabDescriptions esperado. Nenhuma alteracao foi salva."
  }

  $content = $content.Replace(
    $anchor,
    $anchor + "`r`n" + $line
  )

  [System.IO.File]::WriteAllText(
    $file,
    $content,
    [System.Text.UTF8Encoding]::new($false)
  )

  Write-Host "Descricao da aba Tutoriais adicionada."
}

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
Write-Host "HOTFIX 14.5 - DESCRICAO TUTORIAIS - BUILD OK"
Write-Host ""
