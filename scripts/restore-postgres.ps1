param([Parameter(Mandatory=$true)][string]$BackupFile,[Parameter(Mandatory=$true)][string]$TargetDatabaseUrl,[switch]$ConfirmProductionRestore)
$ErrorActionPreference="Stop"
if(-not (Test-Path $BackupFile)){throw "Backup não encontrado."}
if(-not (Get-Command pg_restore -ErrorAction SilentlyContinue)){throw "pg_restore não encontrado."}
if(($TargetDatabaseUrl -match "railway|production|prod") -and -not $ConfirmProductionRestore){throw "Destino parece produção. Valide primeiro em banco temporário."}
& pg_restore --dbname=$TargetDatabaseUrl --clean --if-exists --no-owner --no-privileges --exit-on-error $BackupFile
if($LASTEXITCODE -ne 0){throw "pg_restore falhou."}
Write-Host "Restauração concluída."
