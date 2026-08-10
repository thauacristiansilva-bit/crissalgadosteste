$ErrorActionPreference = "Stop"
Write-Host "Removendo módulos antigos de bairros/Correios/OpenStreetMap..." -ForegroundColor Cyan

$paths = @(
  ".\app\api\address",
  ".\lib\address-location-client.ts",
  ".\lib\correios-postal.ts",
  ".\CEP-CORREIOS-E-BAIRROS.md",
  ".\AJUSTE-BACABAL-MAPA.md",
  ".\AJUSTE-CIDADE-DINAMICA.md",
  ".\OPCAO-B-SEM-GOOGLE-BILLING.md"
)

foreach ($path in $paths) {
  if (Test-Path $path) {
    Remove-Item -Recurse -Force $path
    Write-Host "Removido: $path" -ForegroundColor DarkGray
  }
}

if (Test-Path ".\.next") {
  Remove-Item -Recurse -Force ".\.next"
  Write-Host "Cache .next removido." -ForegroundColor DarkGray
}

Write-Host "Limpeza concluida. Agora execute: npm run dev" -ForegroundColor Green
