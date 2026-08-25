$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$HistoryDir = Join-Path $Root "docs\historico"

New-Item -ItemType Directory -Force -Path $HistoryDir | Out-Null

$Patterns = @(
  "AJUSTE-*.md",
  "ATUALIZACAO-*.md",
  "ATUALIZAR-*.md",
  "CONFIGURAR-*.md",
  "CORRECAO-*.md",
  "INSTALAR-*.md",
  "LEIA-ME*.md",
  "LEIA-ME*.txt",
  "MAPA-*.md",
  "RECURSOS-DA-VERSAO.md"
)

$Moved = 0
foreach ($Pattern in $Patterns) {
  Get-ChildItem -Path $Root -File -Filter $Pattern -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne "README.md" } |
    ForEach-Object {
      $Destination = Join-Path $HistoryDir $_.Name
      Move-Item -Force -Path $_.FullName -Destination $Destination
      Write-Host "Movido: $($_.Name) -> docs/historico/"
      $Moved++
    }
}

Write-Host ""
Write-Host "Limpeza concluida. Documentos movidos: $Moved"
Write-Host "Arquivos de runtime, migrations, banco, uploads e scripts operacionais nao foram apagados."
