BEGIN;

CREATE TABLE IF NOT EXISTS sf_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  subject text NOT NULL,
  customer_name text,
  customer_email text,
  customer_phone text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'email', 'whatsapp', 'system')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'open', 'waiting_customer', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_support_tickets_org_status_idx
  ON sf_support_tickets (organization_id, status, priority, last_message_at DESC);

CREATE TABLE IF NOT EXISTS sf_support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES sf_support_tickets(id) ON DELETE CASCADE,
  author_type text NOT NULL DEFAULT 'staff' CHECK (author_type IN ('customer', 'staff', 'system')),
  channel text NOT NULL DEFAULT 'internal' CHECK (channel IN ('internal', 'email', 'whatsapp', 'system')),
  body text NOT NULL,
  created_by_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_support_ticket_messages_ticket_idx
  ON sf_support_ticket_messages (organization_id, ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS sf_admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES sf_users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  link_section text,
  source_entity_type text,
  source_entity_id text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_admin_notifications_org_user_idx
  ON sf_admin_notifications (organization_id, user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS sf_notification_preferences (
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES sf_users(id) ON DELETE CASCADE,
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  sms_enabled boolean NOT NULL DEFAULT false,
  destination_email text,
  destination_phone text,
  notify_new_ticket boolean NOT NULL DEFAULT true,
  notify_customer_reply boolean NOT NULL DEFAULT true,
  notify_payment_issue boolean NOT NULL DEFAULT true,
  notify_handoff boolean NOT NULL DEFAULT true,
  notify_contract boolean NOT NULL DEFAULT true,
  notify_printer boolean NOT NULL DEFAULT true,
  notify_low_stock boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS sf_communication_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'trial', 'monthly', 'semiannual', 'annual', 'inactive')),
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp', 'both', 'in_app')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled')),
  subject text,
  body text NOT NULL,
  coupon_code text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_communication_campaigns_org_idx
  ON sf_communication_campaigns (organization_id, status, created_at DESC);

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'sf_support_tickets',
    'sf_support_ticket_messages',
    'sf_admin_notifications',
    'sf_notification_preferences',
    'sf_communication_campaigns'
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
