BEGIN;

ALTER TABLE sf_users
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1
    CHECK (session_version >= 1);

ALTER TABLE sf_memberships
  ADD COLUMN IF NOT EXISTS invited_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL;

ALTER TABLE sf_memberships
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;

ALTER TABLE sf_memberships
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

ALTER TABLE sf_staff_members
  ADD COLUMN IF NOT EXISTS user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sf_staff_members_org_user_unique
  ON sf_staff_members (organization_id, user_id)
  WHERE user_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS sf_auth_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL
    REFERENCES sf_users(id) ON DELETE CASCADE,
  organization_id uuid
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  purpose text NOT NULL
    CHECK (purpose IN ('invite', 'password_reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_auth_tokens_user_purpose_idx
  ON sf_auth_tokens (user_id, purpose, expires_at DESC);

CREATE INDEX IF NOT EXISTS sf_auth_tokens_org_purpose_idx
  ON sf_auth_tokens (organization_id, purpose, expires_at DESC)
  WHERE organization_id IS NOT NULL;


ALTER TABLE sf_organization_domains
  ADD COLUMN IF NOT EXISTS verification_method text NOT NULL DEFAULT 'dns_txt'
    CHECK (verification_method IN ('dns_txt'));

ALTER TABLE sf_organization_domains
  ADD COLUMN IF NOT EXISTS verification_token_hash text;

ALTER TABLE sf_organization_domains
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE sf_organization_domains
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS sf_organization_domains_one_primary_verified
  ON sf_organization_domains (organization_id)
  WHERE primary_domain = true AND verified = true;


CREATE TABLE IF NOT EXISTS sf_print_agents (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS sf_print_agents_org_active_idx
  ON sf_print_agents (organization_id, active, created_at DESC);


CREATE TABLE IF NOT EXISTS sf_rls_rollout (
  table_name text PRIMARY KEY,
  policy_name text NOT NULL DEFAULT 'sf_tenant_guard',
  prepared boolean NOT NULL DEFAULT false,
  enforcement text NOT NULL DEFAULT 'prepared'
    CHECK (enforcement IN ('prepared', 'enabled')),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE OR REPLACE FUNCTION sf_current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
$$;


DO $$
DECLARE
  target_table text;
  tenant_tables text[] := ARRAY[
    'sf_categories',
    'sf_products',
    'sf_catalog_state',
    'sf_orders',
    'sf_order_items',
    'sf_orders_state',
    'sf_customer_accounts',
    'sf_customers_state',
    'sf_coupons',
    'sf_feedbacks',
    'sf_cash_sessions',
    'sf_financial_entries',
    'sf_delivery_zones',
    'sf_couriers',
    'sf_operations_state',
    'sf_staff_members',
    'sf_tenant_runtime_state',
    'sf_organization_settings',
    'sf_memberships',
    'sf_organization_domains',
    'sf_print_agents'
  ];
BEGIN
  FOREACH target_table IN ARRAY tenant_tables
  LOOP
    IF to_regclass('public.' || target_table) IS NOT NULL THEN
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

      -- Fase 10 prepara as políticas, mas NÃO ativa enforcement no mesmo deploy.
      -- Isso evita interromper rotas antigas antes de todas usarem contexto RLS.
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
  END LOOP;
END
$$;


COMMIT;
