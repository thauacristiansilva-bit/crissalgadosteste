-- Etapa 2 comercial: coleta de dados para migração/importação de cadastro antigo.

BEGIN;

CREATE TABLE IF NOT EXISTS sf_migration_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'processing', 'ready', 'completed')),
  source_system text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  source_notes text NOT NULL DEFAULT '',
  delivery_notes text NOT NULL DEFAULT '',
  location_notes text NOT NULL DEFAULT '',
  catalog_notes text NOT NULL DEFAULT '',
  assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_requested boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS sf_migration_intakes_org_status_idx
ON sf_migration_intakes (organization_id, status, updated_at DESC);

DROP POLICY IF EXISTS sf_tenant_guard ON sf_migration_intakes;

CREATE POLICY sf_tenant_guard
ON sf_migration_intakes
USING (sf_rls_tenant_allowed(organization_id))
WITH CHECK (sf_rls_tenant_allowed(organization_id));

ALTER TABLE sf_migration_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_migration_intakes FORCE ROW LEVEL SECURITY;

INSERT INTO sf_rls_rollout (
  table_name,
  policy_name,
  prepared,
  enforcement,
  updated_at
)
VALUES (
  'sf_migration_intakes',
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'saborflow_rls_app'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE sf_migration_intakes
      TO saborflow_rls_app;
  END IF;
END
$$;

COMMIT;
