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