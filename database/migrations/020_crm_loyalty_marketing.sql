BEGIN;

CREATE TABLE IF NOT EXISTS sf_crm_customer_profiles (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  customer_key text NOT NULL,
  customer_id integer,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  notes text NOT NULL DEFAULT '',
  marketing_opt_in boolean NOT NULL DEFAULT false,
  consent_source text,
  consent_at timestamptz,
  last_contact_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, customer_key),
  CONSTRAINT sf_crm_profile_customer_fk
    FOREIGN KEY (organization_id, customer_id)
    REFERENCES sf_customer_accounts (organization_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sf_crm_customer_profiles_org_optin_idx
  ON sf_crm_customer_profiles (organization_id, marketing_opt_in, updated_at DESC);

CREATE INDEX IF NOT EXISTS sf_crm_customer_profiles_org_customer_idx
  ON sf_crm_customer_profiles (organization_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sf_loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  customer_id integer NOT NULL,
  order_id integer,
  kind text NOT NULL
    CHECK (kind IN ('opening', 'earn', 'redeem', 'adjust', 'reversal')),
  points integer NOT NULL CHECK (points <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  reason text NOT NULL DEFAULT '',
  created_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_loyalty_ledger_customer_fk
    FOREIGN KEY (organization_id, customer_id)
    REFERENCES sf_customer_accounts (organization_id, id)
    ON DELETE CASCADE,
  CONSTRAINT sf_loyalty_ledger_order_fk
    FOREIGN KEY (organization_id, order_id)
    REFERENCES sf_orders (organization_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sf_loyalty_ledger_org_customer_idx
  ON sf_loyalty_ledger (organization_id, customer_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS sf_loyalty_ledger_order_earn_unique
  ON sf_loyalty_ledger (organization_id, order_id, kind)
  WHERE order_id IS NOT NULL AND kind = 'earn';

CREATE UNIQUE INDEX IF NOT EXISTS sf_loyalty_ledger_order_reversal_unique
  ON sf_loyalty_ledger (organization_id, order_id, kind)
  WHERE order_id IS NOT NULL AND kind = 'reversal';

CREATE TABLE IF NOT EXISTS sf_crm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL
    CHECK (channel IN ('manual', 'whatsapp', 'email', 'sms')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'archived')),
  audience_segment text NOT NULL DEFAULT 'all'
    CHECK (audience_segment IN (
      'all', 'new', 'repeat', 'frequent', 'elite',
      'active', 'sleeping', 'inactive', 'never'
    )),
  message text NOT NULL,
  coupon_code text,
  scheduled_for timestamptz,
  created_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_crm_campaigns_org_status_idx
  ON sf_crm_campaigns (organization_id, status, updated_at DESC);

INSERT INTO sf_loyalty_ledger (
  organization_id,
  customer_id,
  kind,
  points,
  balance_after,
  reason,
  created_at
)
SELECT
  a.organization_id,
  a.id,
  'opening',
  a.loyalty_points,
  a.loyalty_points,
  'Saldo existente antes da FASE 21',
  now()
FROM sf_customer_accounts a
WHERE a.loyalty_points > 0
  AND NOT EXISTS (
    SELECT 1
    FROM sf_loyalty_ledger l
    WHERE l.organization_id = a.organization_id
      AND l.customer_id = a.id
  );

-- A ativação definitiva das policies PostgreSQL continua reservada para a FASE 24.
ALTER TABLE sf_crm_customer_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE sf_loyalty_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE sf_crm_campaigns DISABLE ROW LEVEL SECURITY;

COMMIT;
