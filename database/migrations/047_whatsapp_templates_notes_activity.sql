BEGIN;

CREATE TABLE IF NOT EXISTS sf_whatsapp_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES sf_integration_connections(id) ON DELETE CASCADE,
  name text NOT NULL,
  label text NOT NULL,
  language_code text NOT NULL DEFAULT 'pt_BR',
  category text NOT NULL DEFAULT 'utility' CHECK (category IN ('utility', 'marketing', 'authentication')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paused', 'disabled')),
  body text NOT NULL,
  use_case text,
  variable_count integer NOT NULL DEFAULT 0 CHECK (variable_count >= 0 AND variable_count <= 20),
  meta_template_id text,
  rejection_reason text,
  created_by_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, connection_id, name, language_code)
);

CREATE INDEX IF NOT EXISTS sf_whatsapp_templates_org_connection_idx
  ON sf_whatsapp_message_templates (organization_id, connection_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS sf_whatsapp_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES sf_integration_connections(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  body text NOT NULL,
  created_by_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_whatsapp_notes_conversation_idx
  ON sf_whatsapp_internal_notes (organization_id, connection_id, contact_phone, created_at DESC);

CREATE TABLE IF NOT EXISTS sf_whatsapp_conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES sf_integration_connections(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('ai', 'user', 'system')),
  actor_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_whatsapp_events_conversation_idx
  ON sf_whatsapp_conversation_events (organization_id, connection_id, contact_phone, created_at DESC);

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'sf_whatsapp_message_templates',
    'sf_whatsapp_internal_notes',
    'sf_whatsapp_conversation_events'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'saborflow_rls_app') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO saborflow_rls_app', target_table);
    END IF;

    IF to_regprocedure('sf_rls_tenant_allowed(uuid)') IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS sf_tenant_guard ON %I', target_table);
      EXECUTE format(
        'CREATE POLICY sf_tenant_guard ON %I USING (sf_rls_tenant_allowed(organization_id)) WITH CHECK (sf_rls_tenant_allowed(organization_id))',
        target_table
      );
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);

      IF to_regclass('public.sf_rls_rollout') IS NOT NULL THEN
        INSERT INTO sf_rls_rollout (table_name, policy_name, prepared, enforcement, updated_at)
        VALUES (target_table, 'sf_tenant_guard', true, 'enabled', now())
        ON CONFLICT (table_name) DO UPDATE SET
          policy_name = EXCLUDED.policy_name,
          prepared = true,
          enforcement = 'enabled',
          updated_at = now();
      END IF;
    ELSIF to_regprocedure('sf_current_organization_id()') IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS sf_tenant_guard ON %I', target_table);
      EXECUTE format(
        'CREATE POLICY sf_tenant_guard ON %I USING (organization_id = sf_current_organization_id()) WITH CHECK (organization_id = sf_current_organization_id())',
        target_table
      );
    END IF;
  END LOOP;
END
$$;

COMMIT;
