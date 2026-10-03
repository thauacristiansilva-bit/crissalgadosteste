-- ETAPA 12C - Publicacao automatica Instagram / Meta
BEGIN;

CREATE TABLE IF NOT EXISTS sf_meta_instagram_connections (
  organization_id uuid PRIMARY KEY
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  page_id text NOT NULL DEFAULT '',
  page_name text NOT NULL DEFAULT '',
  instagram_user_id text NOT NULL,
  instagram_username text NOT NULL DEFAULT '',
  account_type text NOT NULL DEFAULT '',
  access_token_encrypted text NOT NULL,
  token_expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  sf_meta_instagram_connections_active_idx
ON sf_meta_instagram_connections (
  active,
  updated_at DESC
);

DROP POLICY IF EXISTS
  sf_tenant_guard
ON sf_meta_instagram_connections;

CREATE POLICY sf_tenant_guard
ON sf_meta_instagram_connections
USING (
  sf_rls_tenant_allowed(organization_id)
)
WITH CHECK (
  sf_rls_tenant_allowed(organization_id)
);

ALTER TABLE sf_meta_instagram_connections
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE sf_meta_instagram_connections
  FORCE ROW LEVEL SECURITY;

ALTER TABLE sf_marketing_publications
  ADD COLUMN IF NOT EXISTS remote_container_id text,
  ADD COLUMN IF NOT EXISTS remote_media_id text,
  ADD COLUMN IF NOT EXISTS publish_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_key uuid,
  ADD COLUMN IF NOT EXISTS processing_until timestamptz;

CREATE INDEX IF NOT EXISTS
  sf_marketing_publications_due_idx
ON sf_marketing_publications (
  status,
  active,
  COALESCE(next_attempt_at, scheduled_at)
)
WHERE
  status = 'scheduled'
  AND active = true;

INSERT INTO sf_rls_rollout (
  table_name,
  policy_name,
  prepared,
  enforcement,
  updated_at
)
VALUES (
  'sf_meta_instagram_connections',
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
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'saborflow_rls_app'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE sf_meta_instagram_connections
      TO saborflow_rls_app;

    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE sf_marketing_publications
      TO saborflow_rls_app;
  END IF;
END
$$;

COMMIT;
