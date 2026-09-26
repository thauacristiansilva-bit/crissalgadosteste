$ErrorActionPreference = "Stop"

$p = "next.config.mjs"
$lines = [System.Collections.Generic.List[string]](Get-Content $p)

function Add-ToDirective {
    param(
        [string]$Directive,
        [string[]]$Values
    )

    $index = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match [regex]::Escape('"' + $Directive + '"')) {
            $index = $i
            break
        }
    }

    if ($index -lt 0) {
        Write-Host "Diretiva $Directive nao encontrada." -ForegroundColor Yellow
        return
    }

    $end = [Math]::Min($index + 20, $lines.Count - 1)
    $block = ($lines[$index..$end] -join "`n")

    $indent = ($lines[$index] -replace '^(\s*).*$', '$1') + "  "

    $insert = @()

    foreach ($value in $Values) {
        if ($block -notmatch [regex]::Escape($value)) {
            $insert += "$indent`"$value`","
        }
    }

    if ($insert.Count -gt 0) {
        for ($j = $insert.Count - 1; $j -ge 0; $j--) {
            $lines.Insert($index + 1, $insert[$j])
        }
    }
}

Add-ToDirective "script-src" @(
    "https://maps.googleapis.com",
    "https://maps.gstatic.com"
)

Add-ToDirective "connect-src" @(
    "https://maps.googleapis.com",
    "https://maps.gstatic.com"
)

Add-ToDirective "img-src" @(
    "https://maps.googleapis.com",
    "https://maps.gstatic.com"
)

Add-ToDirective "style-src" @(
    "https://fonts.googleapis.com"
)

Add-ToDirective "font-src" @(
    "https://fonts.gstatic.com"
)

[System.IO.File]::WriteAllLines(
    $p,
    $lines,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "Google Maps liberado na CSP." -ForegroundColor Green