BEGIN;

ALTER TABLE sf_plan_entitlements
  DROP CONSTRAINT IF EXISTS sf_plan_entitlements_entitlement_key_check;

ALTER TABLE sf_plan_entitlements
  ADD CONSTRAINT sf_plan_entitlements_entitlement_key_check
  CHECK (entitlement_key IN (
    'maxOrganizations',
    'maxUsers',
    'maxProducts',
    'customDomain',
    'delivery',
    'kitchen',
    'financial',
    'loyalty',
    'modifiers',
    'inventory',
    'advancedReports',
    'integrations'
  ));

INSERT INTO sf_plan_entitlements (plan_id, entitlement_key, entitlement_value)
SELECT id, 'integrations',
  CASE WHEN code = 'legacy-existing' THEN 'true'::jsonb ELSE 'false'::jsonb END
FROM sf_plans
WHERE code IN ('legacy-existing', 'demo-sandbox')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET
  entitlement_value = EXCLUDED.entitlement_value,
  updated_at = now();

CREATE TABLE IF NOT EXISTS sf_integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'webhook')),
  provider text NOT NULL CHECK (provider IN ('resend', 'twilio', 'whatsapp_meta', 'webhook')),
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled', 'active', 'error')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  encrypted_credentials text NOT NULL,
  credential_version integer NOT NULL DEFAULT 1,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  created_by_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS sf_integration_connections_org_status_idx
  ON sf_integration_connections (organization_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS sf_integration_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES sf_integration_connections(id) ON DELETE RESTRICT,
  campaign_id uuid REFERENCES sf_crm_campaigns(id) ON DELETE SET NULL,
  customer_id integer,
  recipient_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'webhook')),
  recipient text NOT NULL,
  subject text,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text,
  provider_status text,
  idempotency_key text NOT NULL,
  last_error text,
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS sf_integration_outbox_due_idx
  ON sf_integration_outbox (status, next_attempt_at, created_at)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS sf_integration_outbox_org_idx
  ON sf_integration_outbox (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sf_integration_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  outbox_id uuid NOT NULL REFERENCES sf_integration_outbox(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status text NOT NULL CHECK (status IN ('sent', 'retry', 'failed')),
  provider_message_id text,
  provider_status text,
  error text,
  duration_ms integer NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outbox_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS sf_integration_attempts_org_created_idx
  ON sf_integration_attempts (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sf_integration_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES sf_integration_connections(id) ON DELETE RESTRICT,
  provider_event_id text NOT NULL,
  event_type text,
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (connection_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS sf_integration_webhook_events_org_created_idx
  ON sf_integration_webhook_events (organization_id, received_at DESC);

-- Prepara as policies sem ativar enforcement. A ativação definitiva segue reservada para a FASE 24.
DO $$
DECLARE
  target_table text;
BEGIN
  IF to_regprocedure('sf_current_organization_id()') IS NOT NULL
     AND to_regclass('public.sf_rls_rollout') IS NOT NULL THEN
    FOREACH target_table IN ARRAY ARRAY[
      'sf_integration_connections',
      'sf_integration_outbox',
      'sf_integration_attempts',
      'sf_integration_webhook_events'
    ]
    LOOP
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

      INSERT INTO sf_rls_rollout (table_name, policy_name, prepared, enforcement, updated_at)
      VALUES (target_table, 'sf_tenant_guard', true, 'prepared', now())
      ON CONFLICT (table_name)
      DO UPDATE SET
        policy_name = EXCLUDED.policy_name,
        prepared = true,
        enforcement = 'prepared',
        updated_at = now();
    END LOOP;
  END IF;
END
$$;

COMMIT;
