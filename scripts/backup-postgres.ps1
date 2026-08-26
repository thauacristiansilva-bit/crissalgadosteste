param([string]$DatabaseUrl=$env:DATABASE_PUBLIC_URL,[string]$OutputDirectory=".\backups")
$ErrorActionPreference="Stop"
if(-not $DatabaseUrl){$DatabaseUrl=$env:DATABASE_URL}
if(-not $DatabaseUrl){throw "Defina DATABASE_PUBLIC_URL ou DATABASE_URL."}
if(-not (Get-Command pg_dump -ErrorAction SilentlyContinue)){throw "pg_dump não encontrado."}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$output=Join-Path $OutputDirectory "saborflow-$stamp.dump"
& pg_dump $DatabaseUrl --format=custom --no-owner --no-privileges --file=$output
if($LASTEXITCODE -ne 0){throw "pg_dump falhou."}
$hash=Get-FileHash $output -Algorithm SHA256
@{createdAt=(Get-Date).ToUniversalTime().ToString("o");file=(Split-Path $output -Leaf);sha256=$hash.Hash}|ConvertTo-Json|Set-Content "$output.json" -Encoding UTF8
Write-Host "Backup concluído: $output"
Write-Host "SHA256: $($hash.Hash)"
