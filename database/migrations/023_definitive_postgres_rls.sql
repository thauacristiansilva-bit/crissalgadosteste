BEGIN;

-- FASE 24: o runtime passa a usar um papel NOLOGIN/NOBYPASSRLS dedicado.
-- Mesmo que DATABASE_URL use o proprietário do banco, as consultas normais
-- executam SET ROLE saborflow_rls_app e ficam sujeitas ao RLS/FORCE RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'saborflow_rls_app'
  ) THEN
    CREATE ROLE saborflow_rls_app
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOBYPASSRLS;
  END IF;
END
$$;

ALTER ROLE saborflow_rls_app
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOBYPASSRLS;

GRANT saborflow_rls_app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO saborflow_rls_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO saborflow_rls_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO saborflow_rls_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO saborflow_rls_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO saborflow_rls_app;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;


CREATE OR REPLACE FUNCTION sf_current_organization_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN NULLIF(current_setting('app.organization_ids', true), '') IS NOT NULL THEN
      string_to_array(current_setting('app.organization_ids', true), ',')::uuid[]
    WHEN NULLIF(current_setting('app.organization_id', true), '') IS NOT NULL THEN
      ARRAY[current_setting('app.organization_id', true)::uuid]
    ELSE
      ARRAY[]::uuid[]
  END
$$;

CREATE OR REPLACE FUNCTION sf_current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (sf_current_organization_ids())[1]
$$;

CREATE OR REPLACE FUNCTION sf_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION sf_rls_bypass_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.rls_bypass', true), 'false') = 'true'
$$;

CREATE OR REPLACE FUNCTION sf_rls_tenant_allowed(candidate uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    sf_rls_bypass_enabled()
    OR candidate = ANY(sf_current_organization_ids())
$$;

GRANT EXECUTE ON FUNCTION sf_current_organization_ids() TO saborflow_rls_app;
GRANT EXECUTE ON FUNCTION sf_current_organization_id() TO saborflow_rls_app;
GRANT EXECUTE ON FUNCTION sf_current_user_id() TO saborflow_rls_app;
GRANT EXECUTE ON FUNCTION sf_rls_bypass_enabled() TO saborflow_rls_app;
GRANT EXECUTE ON FUNCTION sf_rls_tenant_allowed(uuid) TO saborflow_rls_app;


CREATE TABLE IF NOT EXISTS sf_rls_exemptions (
  table_name text PRIMARY KEY,
  reason text NOT NULL,
  scope text NOT NULL DEFAULT 'control-plane',
  reviewed_phase integer NOT NULL DEFAULT 24,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sf_rls_exemptions (table_name, reason, scope, reviewed_phase, updated_at)
VALUES
  (
    'sf_usage_counters',
    'Contador pertence à conta de cobrança e pode agregar várias organizações.',
    'billing-control-plane',
    24,
    now()
  ),
  (
    'sf_support_cases',
    'Caso de suporte pertence ao control plane e organization_id é apenas referência opcional.',
    'platform-control-plane',
    24,
    now()
  ),
  (
    'sf_corporate_group_organizations',
    'Tabela de vínculo corporativo precisa representar matriz e filiais em um único grupo.',
    'corporate-control-plane',
    24,
    now()
  )
ON CONFLICT (table_name)
DO UPDATE SET
  reason = EXCLUDED.reason,
  scope = EXCLUDED.scope,
  reviewed_phase = 24,
  updated_at = now();


DO $$
DECLARE
  target_table text;
BEGIN
  IF to_regclass('public.sf_rls_rollout') IS NULL THEN
    RAISE EXCEPTION 'sf_rls_rollout não existe. A preparação da Fase 10 é obrigatória antes da Fase 24.';
  END IF;

  FOR target_table IN
    SELECT c.relname
    FROM pg_class c
    INNER JOIN pg_namespace n
      ON n.oid = c.relnamespace
    INNER JOIN pg_attribute a
      ON a.attrelid = c.oid
     AND a.attname = 'organization_id'
     AND a.attnum > 0
     AND NOT a.attisdropped
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname LIKE 'sf_%'
      AND c.relname NOT IN (
        'sf_usage_counters',
        'sf_support_cases',
        'sf_corporate_group_organizations'
      )
    ORDER BY c.relname
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS sf_tenant_guard ON %I', target_table);

    IF target_table = 'sf_memberships' THEN
      EXECUTE format(
        'CREATE POLICY sf_tenant_guard ON %I USING (sf_rls_tenant_allowed(organization_id) OR user_id = sf_current_user_id()) WITH CHECK (sf_rls_tenant_allowed(organization_id) OR user_id = sf_current_user_id())',
        target_table
      );
    ELSIF target_table = 'sf_auth_tokens' THEN
      EXECUTE format(
        'CREATE POLICY sf_tenant_guard ON %I USING (sf_rls_tenant_allowed(organization_id) OR user_id = sf_current_user_id()) WITH CHECK (sf_rls_tenant_allowed(organization_id) OR user_id = sf_current_user_id())',
        target_table
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY sf_tenant_guard ON %I USING (sf_rls_tenant_allowed(organization_id)) WITH CHECK (sf_rls_tenant_allowed(organization_id))',
        target_table
      );
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);

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
      'enabled',
      now()
    )
    ON CONFLICT (table_name)
    DO UPDATE SET
      policy_name = EXCLUDED.policy_name,
      prepared = true,
      enforcement = 'enabled',
      updated_at = now();
  END LOOP;
END
$$;

-- As exceções são control-plane, não dados operacionais de um tenant.
-- Garantimos explicitamente que elas não sejam confundidas com rollout tenant.
DELETE FROM sf_rls_rollout
WHERE table_name IN (
  'sf_usage_counters',
  'sf_support_cases',
  'sf_corporate_group_organizations'
);

COMMIT;
