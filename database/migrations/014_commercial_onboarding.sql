BEGIN;

CREATE TABLE IF NOT EXISTS sf_organization_onboarding (
  organization_id uuid PRIMARY KEY
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 3
    CHECK (version >= 3),
  current_step text NOT NULL DEFAULT 'business'
    CHECK (current_step IN (
      'business',
      'brand',
      'hours',
      'fulfillment',
      'catalog',
      'publish',
      'published'
    )),
  completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(completed_steps) = 'array'),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_organization_onboarding_step_idx
  ON sf_organization_onboarding (current_step, updated_at DESC);

-- Organizações que já existiam antes da Fase 15 permanecem prontas.
-- O novo fluxo só será obrigatório para lojas criadas pelo onboarding v3.
INSERT INTO sf_organization_onboarding (
  organization_id,
  version,
  current_step,
  completed_steps,
  started_at,
  completed_at,
  published_at,
  updated_at
)
SELECT
  o.id,
  3,
  'published',
  '["business","brand","hours","fulfillment","catalog","publish"]'::jsonb,
  o.created_at,
  COALESCE(o.onboarding_completed_at, now()),
  CASE
    WHEN o.public_store_enabled OR o.public_ordering_enabled THEN now()
    ELSE COALESCE(o.onboarding_completed_at, now())
  END,
  now()
FROM sf_organizations o
WHERE o.onboarding_status = 'complete'
ON CONFLICT (organization_id) DO NOTHING;

-- Se existir alguma organização antiga ainda pendente, ela entra no início do fluxo.
INSERT INTO sf_organization_onboarding (
  organization_id,
  version,
  current_step,
  completed_steps,
  started_at,
  updated_at
)
SELECT
  o.id,
  3,
  'business',
  '[]'::jsonb,
  o.created_at,
  now()
FROM sf_organizations o
WHERE o.onboarding_status <> 'complete'
ON CONFLICT (organization_id) DO NOTHING;

-- Prepara RLS para a nova tabela, mas mantém enforcement desligado até a Fase 24.
DO $$
DECLARE
  target_table text := 'sf_organization_onboarding';
BEGIN
  IF to_regprocedure('sf_current_organization_id()') IS NOT NULL
     AND to_regclass('public.sf_rls_rollout') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
        AND policyname = 'sf_tenant_guard'
    ) THEN
      EXECUTE format(
        'CREATE POLICY sf_tenant_guard ON %I USING (organization_id = sf_current_organization_id()) WITH CHECK (organization_id = sf_current_organization_id())',
        target_table
      );
    END IF;

    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', target_table);

    INSERT INTO sf_rls_rollout (
      table_name,
      policy_name,
      prepared,
      enforcement,
      updated_at
    )
    VALUES (
      target_table,
      'sf_tenant_guard',
      true,
      'prepared',
      now()
    )
    ON CONFLICT (table_name)
    DO UPDATE SET
      policy_name = EXCLUDED.policy_name,
      prepared = true,
      enforcement = 'prepared',
      updated_at = now();
  END IF;
END
$$;

COMMIT;
