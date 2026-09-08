-- Etapa 14.5
-- Central de Ajuda / Base de Conhecimento global do SaborFlow.
-- Conteudo da plataforma, nao vinculado a uma organizacao especifica.

CREATE TABLE IF NOT EXISTS sf_help_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_help_categories_active_order_idx
  ON sf_help_categories (active, sort_order, name);


CREATE TABLE IF NOT EXISTS sf_help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid
    REFERENCES sf_help_categories(id) ON DELETE SET NULL,

  slug text NOT NULL UNIQUE,
  feature_key text,

  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  keywords text[] NOT NULL DEFAULT ARRAY[]::text[],

  audience text NOT NULL DEFAULT 'admin'
    CHECK (audience IN ('admin', 'customer', 'all')),

  video_url text,
  video_storage_key text,
  video_thumbnail_url text,
  video_duration_seconds integer
    CHECK (
      video_duration_seconds IS NULL
      OR video_duration_seconds >= 0
    ),

  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_help_articles_category_idx
  ON sf_help_articles (category_id, published, sort_order, title);

CREATE INDEX IF NOT EXISTS sf_help_articles_feature_idx
  ON sf_help_articles (feature_key)
  WHERE feature_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_help_articles_keywords_idx
  ON sf_help_articles USING gin (keywords);

CREATE INDEX IF NOT EXISTS sf_help_articles_search_idx
  ON sf_help_articles
  USING gin (
    to_tsvector(
      'portuguese',
      coalesce(title, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(content, '')
    )
  );


-- Categorias iniciais da Central de Ajuda.
INSERT INTO sf_help_categories (
  slug,
  name,
  description,
  sort_order
)
VALUES
  (
    'primeiros-passos',
    'Primeiros passos',
    'Boas-vindas, visão geral e configuração inicial do SaborFlow.',
    10
  ),
  (
    'empresa-e-loja',
    'Empresa e loja',
    'Dados da empresa, horários, identidade visual e configurações gerais.',
    20
  ),
  (
    'cardapio',
    'Cardápio',
    'Produtos, categorias, adicionais, preços e disponibilidade.',
    30
  ),
  (
    'pedidos',
    'Pedidos',
    'Fluxo de pedidos, status, atendimento e acompanhamento.',
    40
  ),
  (
    'pdv-e-caixa',
    'PDV e caixa',
    'Pedidos no balcão, abertura de caixa, entradas, saídas e fechamento.',
    50
  ),
  (
    'cozinha',
    'Cozinha',
    'Produção, impressão, fila e andamento dos pedidos.',
    60
  ),
  (
    'estoque',
    'Estoque',
    'Controle de estoque, alertas e operações de inventário.',
    70
  ),
  (
    'vendas-e-dre',
    'Vendas, DRE e relatórios',
    'Vendas, indicadores, DRE e relatórios gerenciais.',
    80
  ),
  (
    'clientes',
    'Clientes',
    'Cadastro, conta do cliente, histórico e relacionamento.',
    90
  ),
  (
    'fidelidade-e-marketing',
    'Fidelidade e marketing',
    'Pontos, cupons, campanhas, avaliações e divulgação.',
    100
  ),
  (
    'entregas',
    'Entregas',
    'Retirada, entrega, áreas, distâncias, taxas e rastreamento.',
    110
  ),
  (
    'whatsapp',
    'WhatsApp',
    'Atendimento, integração e automações pelo WhatsApp.',
    120
  ),
  (
    'inteligencia-artificial',
    'Inteligência artificial',
    'Recursos de IA do SaborFlow e boas práticas de uso.',
    130
  ),
  (
    'usuarios-e-permissoes',
    'Usuários e permissões',
    'Equipe, acessos, perfis e permissões administrativas.',
    140
  ),
  (
    'seguranca',
    'Segurança',
    'Sessões, autenticação, 2FA, passkeys e proteção da conta.',
    150
  ),
  (
    'dominios-e-integracoes',
    'Domínios e integrações',
    'Domínio próprio, integrações e serviços externos.',
    160
  ),
  (
    'area-do-cliente',
    'Área do cliente',
    'Conta, pedidos, acompanhamento e recursos disponíveis ao cliente final.',
    170
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  active = true,
  updated_at = now();