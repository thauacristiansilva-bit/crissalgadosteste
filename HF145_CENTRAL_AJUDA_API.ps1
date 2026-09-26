$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== HOTFIX 14.5 - CENTRAL DE AJUDA API ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

$file = "lib\help-center-db.ts"

if (-not (Test-Path $file)) {
  throw "Arquivo nao encontrado: $file"
}

$content = [System.IO.File]::ReadAllText($file)

$old = @'
        ORDER BY
          CASE
            WHEN $1 = ''
              THEN 0
            ELSE rank
          END DESC,
          article.sort_order ASC,
          article.title ASC
'@

$new = @'
        ORDER BY
          rank DESC,
          article.sort_order ASC,
          article.title ASC
'@

if ($content.Contains($old)) {
  $content = $content.Replace($old, $new)
}
elseif ($content.Contains($new)) {
  Write-Host "O hotfix ja estava aplicado."
}
else {
  throw "Nao encontrei o ORDER BY esperado. Nenhuma alteracao foi salva."
}

[System.IO.File]::WriteAllText(
  $file,
  $content,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Corrigido: $file"
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
Write-Host "HOTFIX 14.5 - CENTRAL DE AJUDA API - BUILD OK"
Write-Host ""
