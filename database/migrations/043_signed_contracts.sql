BEGIN;

CREATE TABLE IF NOT EXISTS sf_signed_contracts (
  id uuid PRIMARY KEY,
  billing_account_id uuid NOT NULL REFERENCES sf_billing_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES sf_users(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES sf_plans(id) ON DELETE RESTRICT,
  plan_code text NOT NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','semiannual','annual')),
  payment_method text NOT NULL CHECK (payment_method IN ('pix','credit_card','boleto')),
  contract_version text NOT NULL,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  contract_value_cents integer NOT NULL CHECK (contract_value_cents > 0),
  recurring_amount_cents integer NOT NULL CHECK (recurring_amount_cents > 0),
  commitment_months integer NOT NULL CHECK (commitment_months >= 1),
  early_termination_penalty_percent integer NOT NULL DEFAULT 30 CHECK (early_termination_penalty_percent BETWEEN 0 AND 100),
  signature_mime text NOT NULL,
  signature_bytes bytea NOT NULL,
  signature_sha256 text NOT NULL,
  signed_pdf bytea NOT NULL,
  pdf_sha256 text NOT NULL,
  ip_address text,
  user_agent text,
  signed_at timestamptz NOT NULL,
  checkout_session_id uuid REFERENCES sf_checkout_sessions(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES sf_subscriptions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'signed' CHECK (status IN ('signed','payment_pending','approved','canceled')),
  payment_approved_at timestamptz,
  email_sent_at timestamptz,
  email_provider_id text,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sf_signed_contracts_user ON sf_signed_contracts(user_id, signed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sf_signed_contracts_subscription ON sf_signed_contracts(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sf_signed_contracts_checkout_unique ON sf_signed_contracts(checkout_session_id) WHERE checkout_session_id IS NOT NULL;

COMMIT;
