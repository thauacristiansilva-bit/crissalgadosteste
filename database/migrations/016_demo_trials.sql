BEGIN;

CREATE TABLE IF NOT EXISTS sf_demo_environments (
  id uuid PRIMARY KEY,
  kind text NOT NULL
    CHECK (kind IN ('public', 'trial')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'closed')),
  organization_id uuid NOT NULL UNIQUE
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL
    REFERENCES sf_users(id) ON DELETE RESTRICT,
  billing_account_id uuid NOT NULL
    REFERENCES sf_billing_accounts(id) ON DELETE CASCADE,
  requested_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  seed_version integer NOT NULL DEFAULT 1 CHECK (seed_version >= 1),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  expired_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > started_at)
);

CREATE INDEX IF NOT EXISTS sf_demo_environments_status_expiry_idx
  ON sf_demo_environments (status, expires_at);

CREATE INDEX IF NOT EXISTS sf_demo_environments_requester_idx
  ON sf_demo_environments (requested_by_user_id, created_at DESC)
  WHERE requested_by_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sf_demo_environments_active_trial_requester_unique
  ON sf_demo_environments (requested_by_user_id)
  WHERE kind = 'trial'
    AND status = 'active'
    AND requested_by_user_id IS NOT NULL;

-- Plano interno usado exclusivamente por ambientes efêmeros de demonstração.
-- Ele libera os recursos necessários para simular a operação, mas não libera
-- domínio customizado e possui limites pequenos de usuários/produtos.
INSERT INTO sf_plans (
  id,
  code,
  name,
  description,
  active,
  internal,
  checkout_enabled,
  sort_order,
  metadata
)
VALUES (
  md5('saborflow-plan:demo-sandbox')::uuid,
  'demo-sandbox',
  'Ambiente de demonstração',
  'Plano interno e não comercial para demos e trials efêmeros.',
  true,
  true,
  false,
  -90,
  '{"demo":true,"phase":16}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  active = true,
  internal = true,
  checkout_enabled = false,
  metadata = EXCLUDED.metadata,
  updated_at = now();

INSERT INTO sf_plan_entitlements (plan_id, entitlement_key, entitlement_value)
VALUES
  (md5('saborflow-plan:demo-sandbox')::uuid, 'maxOrganizations', '1'::jsonb),
  (md5('saborflow-plan:demo-sandbox')::uuid, 'maxUsers', '3'::jsonb),
  (md5('saborflow-plan:demo-sandbox')::uuid, 'maxProducts', '30'::jsonb),
  (md5('saborflow-plan:demo-sandbox')::uuid, 'customDomain', 'false'::jsonb),
  (md5('saborflow-plan:demo-sandbox')::uuid, 'delivery', 'true'::jsonb),
  (md5('saborflow-plan:demo-sandbox')::uuid, 'kitchen', 'true'::jsonb),
  (md5('saborflow-plan:demo-sandbox')::uuid, 'financial', 'true'::jsonb),
  (md5('saborflow-plan:demo-sandbox')::uuid, 'loyalty', 'true'::jsonb),
  (md5('saborflow-plan:demo-sandbox')::uuid, 'modifiers', 'true'::jsonb),
  (md5('saborflow-plan:demo-sandbox')::uuid, 'inventory', 'true'::jsonb),
  (md5('saborflow-plan:demo-sandbox')::uuid, 'advancedReports', 'true'::jsonb)
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET
  entitlement_value = EXCLUDED.entitlement_value,
  updated_at = now();

-- RLS preparado, sem enforcement, seguindo a estratégia iniciada na Fase 10.
DO $$
DECLARE
  target_table text := 'sf_demo_environments';
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
