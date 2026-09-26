$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== SaborFlow - Coleta Etapa 14.11.1 WhatsApp IA ===" -ForegroundColor Cyan
Write-Host ""

$out = Join-Path (Get-Location) "ETAPA-14-11-CONTEXTO.txt"

$files = New-Object System.Collections.Generic.List[string]

$baseFiles = @(
  "lib\types.ts",
  "lib\integrations-db.ts",
  "lib\integration-providers.ts",
  "lib\organization-db.ts",
  "lib\tenant-checkout.ts",
  "lib\rls-context.ts",
  "lib\postgres.ts",
  "lib\public-tenant.ts",
  "lib\catalog-db.ts",
  "app\api\settings\route.ts",
  "app\api\orders\route.ts",
  "app\api\storefront\ai-order\route.ts",
  "components\admin\integrations-dashboard.tsx",
  "components\admin\admin-dashboard.tsx",
  "components\store\ai-order-assistant.tsx",
  "components\store\store-chatbot.tsx"
)

foreach ($file in $baseFiles) {
  if (Test-Path $file) {
    $files.Add($file)
  }
}

$extraPatterns = @(
  "app\api\admin\integrations\*.ts",
  "app\api\admin\integrations\*\*.ts",
  "app\api\admin\integrations-health\*.ts",
  "components\admin\*ai*.tsx",
  "components\admin\*automation*.tsx",
  "components\admin\*integration*.tsx",
  "lib\ai\*.ts",
  "lib\*whatsapp*.ts"
)

foreach ($pattern in $extraPatterns) {
  Get-ChildItem -Path $pattern -File -ErrorAction SilentlyContinue |
    ForEach-Object {
      $relative = Resolve-Path -Relative $_.FullName
      $relative = $relative -replace '^[.][\\/]', ''
      if (-not $files.Contains($relative)) {
        $files.Add($relative)
      }
    }
}

$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("SABORFLOW - CONTEXTO ETAPA 14.11.1 WHATSAPP IA")
[void]$sb.AppendLine("Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sb.AppendLine("")

[void]$sb.AppendLine("============================================================")
[void]$sb.AppendLine("GIT - ULTIMO COMMIT")
[void]$sb.AppendLine("============================================================")
try {
  $gitLog = git log -1 --oneline 2>&1 | Out-String
  [void]$sb.AppendLine($gitLog.TrimEnd())
} catch {
  [void]$sb.AppendLine("Nao foi possivel ler git log.")
}
[void]$sb.AppendLine("")

[void]$sb.AppendLine("============================================================")
[void]$sb.AppendLine("GIT STATUS --SHORT")
[void]$sb.AppendLine("============================================================")
try {
  $gitStatus = git status --short 2>&1 | Out-String
  [void]$sb.AppendLine($gitStatus.TrimEnd())
} catch {
  [void]$sb.AppendLine("Nao foi possivel ler git status.")
}
[void]$sb.AppendLine("")

[void]$sb.AppendLine("============================================================")
[void]$sb.AppendLine("ROTAS WHATSAPP / INTEGRACOES EXISTENTES")
[void]$sb.AppendLine("============================================================")
Get-ChildItem -Path "app\api" -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object {
    $_.FullName -match "whatsapp|integration|ai-order"
  } |
  Sort-Object FullName |
  ForEach-Object {
    $relative = Resolve-Path -Relative $_.FullName
    [void]$sb.AppendLine($relative)
  }
[void]$sb.AppendLine("")

foreach ($file in ($files | Sort-Object -Unique)) {
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine("============================================================")
  [void]$sb.AppendLine("===== $file =====")
  [void]$sb.AppendLine("============================================================")

  try {
    $content = [System.IO.File]::ReadAllText(
      (Join-Path (Get-Location) $file)
    )
    [void]$sb.AppendLine($content)
  } catch {
    [void]$sb.AppendLine("ERRO AO LER ARQUIVO: $($_.Exception.Message)")
  }
}

[System.IO.File]::WriteAllText(
  $out,
  $sb.ToString(),
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Contexto criado com sucesso:" -ForegroundColor Green
Write-Host $out
Write-Host ""
Write-Host "Envie o arquivo ETAPA-14-11-CONTEXTO.txt no chat." -ForegroundColor Yellow
Write-Host ""
