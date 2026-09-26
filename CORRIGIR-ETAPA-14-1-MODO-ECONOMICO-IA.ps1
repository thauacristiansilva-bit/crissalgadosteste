$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== ETAPA 14.1 - MODO ECONOMICO DA IA ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)

  $dir = Split-Path $Path -Parent
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }

  $clean = $Content.TrimEnd() + [Environment]::NewLine
  [System.IO.File]::WriteAllText(
    (Join-Path (Get-Location) $Path),
    $clean,
    [System.Text.UTF8Encoding]::new($false)
  )
}

$geminiFile = "lib\ai\gemini.ts"
$routeFile = "app\api\admin\ai\chat\route.ts"
$promptFile = "lib\ai\saborflow-assistant.ts"

foreach ($file in @($geminiFile, $routeFile, $promptFile)) {
  if (-not (Test-Path $file)) {
    throw "Arquivo nao encontrado: $file"
  }
}

$gemini = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $geminiFile))
$gemini = $gemini.Replace("maxOutputTokens: 900", "maxOutputTokens: 320")
[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) $geminiFile),
  $gemini,
  [System.Text.UTF8Encoding]::new($false)
)

$route = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $routeFile))
$route = $route.Replace("const MAX_MESSAGES = 12", "const MAX_MESSAGES = 6")
$route = $route.Replace("const MAX_TOTAL_CHARS = 18_000", "const MAX_TOTAL_CHARS = 8_000")
[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) $routeFile),
  $route,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Utf8NoBom $promptFile @'
export const SABORFLOW_AI_SYSTEM_PROMPT = `
Você é a SaborFlow IA.

Responda em português do Brasil, de forma curta e objetiva.

Regras:
- não invente pedidos, clientes, produtos, preços, estoque ou valores;
- não revele nem solicite senhas, tokens, chaves, cookies ou segredos;
- não forneça dados de outra empresa;
- se precisar de dados reais do estabelecimento e eles não estiverem disponíveis, diga que precisa consultar o SaborFlow;
- não confirme ações irreversíveis sem confirmação explícita do usuário.

Ajude com operação, atendimento, cardápio, pedidos e uso do SaborFlow.
`.trim()
'@

Write-Host ""
Write-Host "Modo economico aplicado:"
Write-Host "  - historico maximo: 6 mensagens"
Write-Host "  - contexto maximo: 8.000 caracteres"
Write-Host "  - resposta maxima do modelo: 320 tokens"
Write-Host "  - prompt do sistema reduzido"
Write-Host ""

git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check falhou."
}

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
Write-Host "MODO ECONOMICO IA APROVADO - BUILD OK"
Write-Host ""
