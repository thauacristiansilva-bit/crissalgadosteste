$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== HOTFIX 14.5 - ABA TUTORIAIS SUPERADMIN ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

$file = "components\superadmin\superadmin-dashboard.tsx"

if (-not (Test-Path $file)) {
  throw "Arquivo nao encontrado: $file"
}

$content = [System.IO.File]::ReadAllText($file)

if ($content -notmatch '(?m)^\s*"Tutoriais",\s*$') {
  $old = @'
  "Domínios",
  "Suporte",
'@

  $new = @'
  "Domínios",
  "Tutoriais",
  "Suporte",
'@

  if (-not $content.Contains($old)) {
    throw "Nao encontrei a lista de abas no formato esperado. Nenhuma alteracao foi salva."
  }

  $content = $content.Replace($old, $new)

  [System.IO.File]::WriteAllText(
    $file,
    $content,
    [System.Text.UTF8Encoding]::new($false)
  )

  Write-Host "Adicionada a aba Tutoriais ao tipo Tab."
}
else {
  Write-Host "A aba Tutoriais ja existe na lista principal."
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
Write-Host "HOTFIX 14.5 - ABA TUTORIAIS - BUILD OK"
Write-Host ""
