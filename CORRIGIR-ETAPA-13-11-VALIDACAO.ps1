$ErrorActionPreference = "Stop"

if (-not (Test-Path "next.config.mjs")) {
  throw "Execute este script na pasta raiz do SaborFlow."
}

Write-Host "=== HOTFIX ETAPA 13.11 - VALIDACAO ==="
Write-Host ""

$temp = Join-Path (Get-Location) ".validate-13-11.mjs"

$validator = @'
import nextConfig from "./next.config.mjs"

const rules = await nextConfig.headers()
const globalRule = rules.find((item) => item.source === "/:path*")

if (!globalRule) {
  throw new Error("Regra global de headers nao encontrada.")
}

const headerMap = new Map(
  globalRule.headers.map((item) => [item.key, item.value]),
)

const csp = headerMap.get("Content-Security-Policy") || ""

const requiredCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "frame-src 'self' https://accounts.google.com",
]

for (const directive of requiredCsp) {
  if (!csp.includes(directive)) {
    throw new Error(`CSP ausente: ${directive}`)
  }
}

const requiredHeaders = [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Origin-Agent-Cluster",
]

for (const name of requiredHeaders) {
  if (!headerMap.has(name)) {
    throw new Error(`Header ausente: ${name}`)
  }
}

console.log("OK: configuracao de headers valida")
'@

[System.IO.File]::WriteAllText(
  $temp,
  $validator,
  (New-Object System.Text.UTF8Encoding($false))
)

try {
  node $temp
  if ($LASTEXITCODE -ne 0) {
    throw "Falha na validacao da configuracao."
  }
}
finally {
  Remove-Item $temp -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Verificando diff..."
git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check encontrou problema."
}

Write-Host ""
Write-Host "Executando build..."
npm.cmd run build
$buildExit = $LASTEXITCODE

git restore -- next-env.d.ts 2>$null

if ($buildExit -ne 0) {
  throw "BUILD FALHOU. Envie apenas o erro final."
}

Write-Host ""
Write-Host "=============================================="
Write-Host "HOTFIX 13.11 OK - BUILD APROVADO"
Write-Host "=============================================="
Write-Host "- validacao corrigida sem conflito de aspas"
Write-Host "- CSP e headers mantidos"
Write-Host "- build aprovado"
Write-Host "- ainda nao foi feito commit nem deploy"
