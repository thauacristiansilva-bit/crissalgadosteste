$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$project = (Get-Location).Path
$out = Join-Path $project "ETAPA-13-7-CONTEXTO.txt"

$lines = New-Object System.Collections.Generic.List[string]

function Add-Line([string]$text = "") {
    $lines.Add($text)
}

function Add-Section([string]$title) {
    Add-Line ""
    Add-Line ("=" * 90)
    Add-Line $title
    Add-Line ("=" * 90)
}

function Add-File([string]$relativePath) {
    $path = Join-Path $project $relativePath
    if (Test-Path $path -PathType Leaf) {
        Add-Section "ARQUIVO: $relativePath"
        Get-Content $path | ForEach-Object { Add-Line $_ }
    }
}

Add-Line "SABORFLOW - ETAPA 13.7 - CONTEXTO RBAC"
Add-Line ("Gerado em: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
Add-Line ("Projeto: " + $project)

Add-Section "GIT"
try { Add-Line ("HEAD: " + (git rev-parse HEAD)) } catch {}
try {
    git status --short | ForEach-Object { Add-Line $_ }
} catch {}

Add-Section "ARQUIVOS RELACIONADOS A AUTORIZACAO / EQUIPE / TENANT"
$all = Get-ChildItem app,lib -Recurse -File -Include *.ts,*.tsx -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch '\\node_modules\\|\\.next\\|\\docs\\|\\historico\\'
    }

$patterns = @(
    'getVerifiedTenantSession',
    'getAdminSession',
    'membership',
    'sf_memberships',
    '\brole\b',
    '\bowner\b',
    '\badmin\b',
    '\bmanager\b',
    '\bcashier\b',
    '\bkitchen\b',
    '\bcourier\b',
    '\bmember\b',
    'forbidden',
    'unauthorized',
    'status:\s*403',
    '\b403\b',
    'permission',
    'authorize',
    'authorization'
)

$regex = ($patterns -join '|')

$matches = $all | Select-String -Pattern $regex -CaseSensitive:$false
$matches |
    Sort-Object Path,LineNumber |
    ForEach-Object {
        $rel = $_.Path.Substring($project.Length).TrimStart('\')
        Add-Line ("{0}:{1}: {2}" -f $rel,$_.LineNumber,$_.Line.Trim())
    }

Add-Section "ROTAS API"
Get-ChildItem app\api -Recurse -File -Filter route.ts -ErrorAction SilentlyContinue |
    ForEach-Object {
        Add-Line ($_.FullName.Substring($project.Length).TrimStart('\'))
    }

# Arquivos-base que normalmente concentram auth/RBAC.
$candidates = @(
    'lib\tenant-access.ts',
    'lib\team-access-db.ts',
    'lib\auth.ts',
    'lib\superadmin-auth.ts',
    'lib\admin-user-db.ts',
    'lib\organization-security-db.ts',
    'lib\security\admin-sessions.ts',
    'app\api\admin\team\route.ts',
    'app\api\admin\organization-security\route.ts',
    'app\api\admin\organizations\route.ts',
    'app\api\admin\switch-organization\route.ts'
)

foreach ($file in $candidates) {
    Add-File $file
}

Add-Section "ARQUIVOS COM DEFINICAO EXPLICITA DE ROLES"
$roleFiles = $all | Where-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    $content -match "owner.*admin.*manager|manager.*cashier|cashier.*kitchen|kitchen.*courier|role\s*[:=]"
}

foreach ($f in $roleFiles | Select-Object -First 25) {
    $rel = $f.FullName.Substring($project.Length).TrimStart('\')
    if ($candidates -notcontains $rel) {
        Add-File $rel
    }
}

# Nenhuma variável de ambiente/secrets é incluída.
[System.IO.File]::WriteAllLines($out, $lines, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "CONTEXTO 13.7 GERADO:" -ForegroundColor Green
Write-Host $out
Write-Host ""
Write-Host "Envie o arquivo ETAPA-13-7-CONTEXTO.txt no ChatGPT." -ForegroundColor Cyan
