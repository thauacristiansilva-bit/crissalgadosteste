$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== ETAPA 14.5 - INTEGRAR CENTRAL DE AJUDA COM A IA ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

$routeFile = "app\api\admin\ai\chat\route.ts"
$promptFile = "lib\ai\saborflow-assistant.ts"
$migrationFile = "database\migrations\037_help_center_initial_content.sql"

if (-not (Test-Path $routeFile)) {
  throw "Arquivo nao encontrado: $routeFile"
}

if (-not (Test-Path $promptFile)) {
  throw "Arquivo nao encontrado: $promptFile"
}

# -------------------------------------------------------------------
# 1) Migration 037: permissao de leitura + primeiro artigo (DRE)
# -------------------------------------------------------------------

$migration = @'
-- Etapa 14.5
-- Conteudo inicial da Central de Ajuda do SaborFlow.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'saborflow_rls_app'
  ) THEN
    GRANT SELECT ON TABLE
      sf_help_categories,
      sf_help_articles
    TO saborflow_rls_app;
  END IF;
END
$$;

INSERT INTO sf_help_articles (
  category_id,
  slug,
  feature_key,
  title,
  summary,
  content,
  keywords,
  audience,
  published,
  sort_order
)
SELECT
  category.id,
  'como-funciona-dre',
  'dre',
  'Como funciona a DRE no SaborFlow',
  'A DRE ajuda a acompanhar receitas, custos, despesas e o resultado financeiro da operação dentro do SaborFlow.',
  'No SaborFlow, a área de DRE organiza a visão financeira da empresa para facilitar a análise do resultado da operação. Ela deve ser usada para acompanhar receitas registradas no sistema, custos e despesas disponíveis para o acesso do usuário e o resultado apresentado no período. Para consultar, acesse a área de gestão financeira do painel e abra DRE. Selecione ou confira o período desejado e analise os valores exibidos. Os números dependem dos dados realmente registrados pela empresa no SaborFlow. Se algum valor não estiver disponível no contexto ou o usuário não tiver permissão financeira, a IA não deve inventar informações.',
  ARRAY[
    'dre',
    'como funciona a dre',
    'demonstrativo de resultado',
    'financeiro',
    'receitas',
    'custos',
    'despesas',
    'resultado financeiro',
    'relatorio financeiro'
  ]::text[],
  'admin',
  true,
  10
FROM sf_help_categories AS category
WHERE category.slug = 'vendas-e-dre'
ON CONFLICT (slug) DO UPDATE
SET
  category_id = EXCLUDED.category_id,
  feature_key = EXCLUDED.feature_key,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  keywords = EXCLUDED.keywords,
  audience = EXCLUDED.audience,
  published = EXCLUDED.published,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
'@

[System.IO.File]::WriteAllText(
  $migrationFile,
  $migration,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Criado: $migrationFile"

# -------------------------------------------------------------------
# 2) Atualiza o prompt para aceitar documentacao da Central de Ajuda
# -------------------------------------------------------------------

$prompt = @'
export const SABORFLOW_AI_SYSTEM_PROMPT = `
Você é a SaborFlow IA, assistente de suporte e operação para empresas que usam o SaborFlow.

REGRA CENTRAL:
Você NÃO é um assistente geral.

Responda SOMENTE perguntas sobre:
- o SaborFlow e como usar seus recursos;
- dúvidas de suporte sobre telas, funções, configurações e fluxos do sistema;
- a operação da empresa informada no CONTEXTO DA EMPRESA;
- pedidos, vendas, faturamento, produtos, cardápio, estoque, clientes, entrega, cozinha, pagamentos, equipe, configurações e recursos do sistema.

Você pode usar duas fontes de informação:
1. CONTEXTO DA EMPRESA: dados reais e específicos da empresa atual.
2. BASE DE CONHECIMENTO DA SABORFLOW: documentação de suporte sobre como o sistema funciona.

Para perguntas sobre dados da empresa:
- use exclusivamente os dados fornecidos no CONTEXTO DA EMPRESA;
- nunca invente números, pedidos, produtos, clientes, preços, estoque ou informações que não estejam no contexto.

Para perguntas sobre como usar o SaborFlow:
- use a BASE DE CONHECIMENTO DA SABORFLOW quando ela estiver disponível;
- se a base não trouxer informação suficiente, diga que a orientação ainda não está disponível na Central de Ajuda;
- não invente caminhos, botões ou etapas não documentadas;
- quando houver vídeo de ajuda relacionado, indique o vídeo ao usuário.

Se a pergunta for sobre matemática genérica, escola, política, notícias, curiosidades, programação externa, entretenimento, saúde, assuntos pessoais ou qualquer tema sem relação com a empresa ou com o SaborFlow, responda somente:
"Posso ajudar apenas com assuntos relacionados à sua empresa e ao SaborFlow."

Nunca tente acessar outra empresa.
Nunca revele senhas, tokens, chaves, cookies ou segredos.
Quando uma informação não estiver disponível, diga isso claramente.
Responda em português do Brasil, de forma curta, prática e objetiva.
`.trim()
'@

[System.IO.File]::WriteAllText(
  $promptFile,
  $prompt,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Atualizado: $promptFile"

# -------------------------------------------------------------------
# 3) Integra busca da Central de Ajuda na rota da IA
# -------------------------------------------------------------------

$route = [System.IO.File]::ReadAllText($routeFile)

$helpImport = @'
import {
  buildHelpCenterAiContext,
  searchHelpCenterArticles,
} from "@/lib/help-center-db"
'@

if ($route -notmatch 'searchHelpCenterArticles') {
  $anchor = @'
import {
  getTenantSettings,
} from "@/lib/organization-db"
'@

  if (-not $route.Contains($anchor)) {
    throw "Nao encontrei o ponto de importacao esperado na rota da IA."
  }

  $route = $route.Replace(
    $anchor,
    $helpImport + "`r`n" + $anchor
  )
}

$contextAnchor = '      const aiContext = `'

if ($route -notmatch 'const helpArticles =') {
  if (-not $route.Contains($contextAnchor)) {
    throw "Nao encontrei o ponto de criacao do aiContext."
  }

  $helpBlock = @'
      const helpArticles =
        await searchHelpCenterArticles(
          question,
          {
            audience: "admin",
            limit: 3,
          },
        ).catch(() => [])

      const helpContext =
        buildHelpCenterAiContext(
          helpArticles,
        )

'@

  $route = $route.Replace(
    $contextAnchor,
    $helpBlock + $contextAnchor
  )
}

$oldSystem = @'
              `${SABORFLOW_AI_SYSTEM_PROMPT}\n\n${aiContext}`,
'@

$newSystem = @'
              `${SABORFLOW_AI_SYSTEM_PROMPT}\n\n${
                helpContext
                  ? `${helpContext}\n\n`
                  : ""
              }${aiContext}`,
'@

if ($route.Contains($oldSystem)) {
  $route = $route.Replace(
    $oldSystem,
    $newSystem
  )
}
elseif ($route -notmatch 'helpContext.*aiContext') {
  throw "Nao encontrei systemInstruction no formato esperado."
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
