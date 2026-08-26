param([string]$BaseUrl="https://appsaborflow.com.br")
$ErrorActionPreference="Stop"
$BaseUrl=$BaseUrl.TrimEnd("/")
$health=Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get -TimeoutSec 10
$ready=Invoke-RestMethod -Uri "$BaseUrl/api/ready" -Method Get -TimeoutSec 10
Write-Host "HEALTH:"; $health|ConvertTo-Json -Depth 8
Write-Host "`nREADY:"; $ready|ConvertTo-Json -Depth 8
if(-not $health.ok -or -not $ready.ok){throw "SaborFlow não passou na verificação."}
Write-Host "`nSaborFlow saudável."
