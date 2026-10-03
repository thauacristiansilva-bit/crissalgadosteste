BEGIN;

CREATE TABLE IF NOT EXISTS sf_whatsapp_conversations (
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES sf_integration_connections(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  contact_name text NOT NULL DEFAULT 'Cliente',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'closed')),
  ai_mode text NOT NULL DEFAULT 'ai' CHECK (ai_mode IN ('ai', 'human')),
  handoff_requested boolean NOT NULL DEFAULT false,
  handoff_reason text,
  labels text[] NOT NULL DEFAULT ARRAY[]::text[],
  assigned_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  closed_by_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_at timestamptz,
  last_read_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, connection_id, contact_phone)
);

CREATE INDEX IF NOT EXISTS sf_whatsapp_conversations_org_updated_idx
  ON sf_whatsapp_conversations (organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS sf_whatsapp_conversations_org_status_idx
  ON sf_whatsapp_conversations (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS sf_whatsapp_conversations_assignee_idx
  ON sf_whatsapp_conversations (organization_id, assigned_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS sf_whatsapp_conversations_labels_idx
  ON sf_whatsapp_conversations USING GIN (labels);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'saborflow_rls_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON sf_whatsapp_conversations TO saborflow_rls_app;
  END IF;

  IF to_regprocedure('sf_rls_tenant_allowed(uuid)') IS NOT NULL THEN
    DROP POLICY IF EXISTS sf_tenant_guard ON sf_whatsapp_conversations;
    CREATE POLICY sf_tenant_guard ON sf_whatsapp_conversations
      USING (sf_rls_tenant_allowed(organization_id))
      WITH CHECK (sf_rls_tenant_allowed(organization_id));
    ALTER TABLE sf_whatsapp_conversations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sf_whatsapp_conversations FORCE ROW LEVEL SECURITY;

    IF to_regclass('public.sf_rls_rollout') IS NOT NULL THEN
      INSERT INTO sf_rls_rollout (table_name, policy_name, prepared, enforcement, updated_at)
      VALUES ('sf_whatsapp_conversations', 'sf_tenant_guard', true, 'enabled', now())
      ON CONFLICT (table_name) DO UPDATE SET
        policy_name = EXCLUDED.policy_name,
        prepared = true,
        enforcement = 'enabled',
        updated_at = now();
    END IF;
  ELSIF to_regprocedure('sf_current_organization_id()') IS NOT NULL THEN
    DROP POLICY IF EXISTS sf_tenant_guard ON sf_whatsapp_conversations;
    CREATE POLICY sf_tenant_guard ON sf_whatsapp_conversations
      USING (organization_id = sf_current_organization_id())
      WITH CHECK (organization_id = sf_current_organization_id());
  END IF;
END
$$;

COMMIT;
