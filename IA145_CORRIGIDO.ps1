$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== ETAPA 14.5 - CORRECAO INTEGRACAO AJUDA + IA ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

$routeFile = "app\api\admin\ai\chat\route.ts"

if (-not (Test-Path $routeFile)) {
  throw "Arquivo nao encontrado: $routeFile"
}

$route = [System.IO.File]::ReadAllText($routeFile)

# 1) Importa a busca da Central de Ajuda.
if ($route -notmatch '@/lib/help-center-db') {
  $helpImport = @'
import {
  buildHelpCenterAiContext,
  searchHelpCenterArticles,
} from "@/lib/help-center-db"

'@

  $route = $helpImport + $route
}

# 2) Insere a busca imediatamente antes da criacao do aiContext.
if ($route -notmatch 'const\s+helpArticles\s*=') {
  $match = [regex]::Match(
    $route,
    '(?m)^(?<indent>[ \t]*)const\s+aiContext\s*='
  )

  if (-not $match.Success) {
    throw "Ainda nao encontrei const aiContext na rota da IA. Nenhuma alteracao foi salva."
  }

  $indent = $match.Groups["indent"].Value

  $helpBlock = @"
${indent}const helpArticles =
${indent}  await searchHelpCenterArticles(
${indent}    question,
${indent}    {
${indent}      audience: "admin",
${indent}      limit: 3,
${indent}    },
${indent}  ).catch(() => [])

${indent}const helpContext =
${indent}  buildHelpCenterAiContext(
${indent}    helpArticles,
${indent}  )

"@

  $route = $route.Insert(
    $match.Index,
    $helpBlock
  )
}

# 3) Coloca a documentacao encontrada dentro do mesmo contexto
# enviado ao Gemini, sem depender do formato do systemInstruction.
if ($route -notmatch '\$\{helpContext\s*\?') {
  $marker = "CONTEXTO DA EMPRESA"

  if (-not $route.Contains($marker)) {
    throw "Nao encontrei CONTEXTO DA EMPRESA na rota da IA."
  }

  $replacement = @'
${helpContext ? `${helpContext}\n\n` : ""}CONTEXTO DA EMPRESA
'@

  $index = $route.IndexOf($marker)

  $route =
    $route.Substring(0, $index) +
    $replacement +
    $route.Substring($index + $marker.Length)
}

[System.IO.File]::WriteAllText(
  $routeFile,
  $route,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Atualizado: $routeFile"
Write-Host ""

git diff --check

if ($LASTEXITCODE -ne 0) {
  throw "git diff --check falhou."
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

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
Write-Host "ETAPA 14.5 - INTEGRACAO AJUDA + IA - BUILD OK"
Write-Host ""
