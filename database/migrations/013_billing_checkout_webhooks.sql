BEGIN;

ALTER TABLE sf_plans
  ADD COLUMN IF NOT EXISTS checkout_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE sf_plans
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS sf_plans_checkout_idx
  ON sf_plans (checkout_enabled, active, internal, sort_order, name);

ALTER TABLE sf_billing_accounts
  ADD COLUMN IF NOT EXISTS onboarding_unlocked_at timestamptz;

ALTER TABLE sf_subscriptions
  ADD COLUMN IF NOT EXISTS source_checkout_session_id uuid;

ALTER TABLE sf_subscriptions
  ADD COLUMN IF NOT EXISTS provider_status text;

ALTER TABLE sf_subscriptions
  ADD COLUMN IF NOT EXISTS last_provider_sync_at timestamptz;

CREATE TABLE IF NOT EXISTS sf_checkout_sessions (
  id uuid PRIMARY KEY,
  billing_account_id uuid NOT NULL
    REFERENCES sf_billing_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES sf_users(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL
    REFERENCES sf_plans(id) ON DELETE RESTRICT,
  subscription_id uuid NOT NULL
    REFERENCES sf_subscriptions(id) ON DELETE CASCADE,
  billing_cycle text NOT NULL
    CHECK (billing_cycle IN ('monthly', 'annual')),
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'creating'
    CHECK (status IN (
      'creating',
      'pending',
      'completed',
      'failed',
      'canceled',
      'expired'
    )),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'BRL',
  provider_checkout_id text,
  provider_subscription_id text,
  checkout_url text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_checkout_sessions_subscription_unique
  ON sf_checkout_sessions (subscription_id);

CREATE UNIQUE INDEX IF NOT EXISTS sf_checkout_sessions_provider_subscription_unique
  ON sf_checkout_sessions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_checkout_sessions_account_created_idx
  ON sf_checkout_sessions (billing_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sf_checkout_sessions_status_idx
  ON sf_checkout_sessions (status, updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sf_subscriptions_source_checkout_session_fk'
  ) THEN
    ALTER TABLE sf_subscriptions
      ADD CONSTRAINT sf_subscriptions_source_checkout_session_fk
      FOREIGN KEY (source_checkout_session_id)
      REFERENCES sf_checkout_sessions(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sf_billing_webhook_events (
  id uuid PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text,
  resource_id text,
  signature_valid boolean NOT NULL DEFAULT true,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_billing_webhook_events_provider_event_unique
  ON sf_billing_webhook_events (provider, provider_event_id);

CREATE INDEX IF NOT EXISTS sf_billing_webhook_events_status_idx
  ON sf_billing_webhook_events (processing_status, received_at DESC);

-- A Fase 13 criou assinaturas internas apenas para preservar contas antigas.
-- Elas continuam válidas até que uma assinatura comercial paga seja confirmada.
-- Nenhum plano público ou preço é inventado nesta migration: o proprietário do SaaS
-- deve publicar os planos comerciais explicitamente usando o script da Fase 14.

COMMIT;
