BEGIN;

CREATE TABLE IF NOT EXISTS sf_customer_accounts (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  cpf_hash text NOT NULL,
  cpf_last4 varchar(4) NOT NULL,
  pin_hash text NOT NULL,
  google_subject text,
  name text NOT NULL,
  phone text NOT NULL,
  phone_normalized text NOT NULL,
  email text NOT NULL DEFAULT '',
  email_normalized text NOT NULL DEFAULT '',
  default_address text NOT NULL DEFAULT '',
  default_number text NOT NULL DEFAULT '',
  default_district text NOT NULL DEFAULT '',
  default_city text NOT NULL DEFAULT '',
  default_state text NOT NULL DEFAULT '',
  default_zip_code text NOT NULL DEFAULT '',
  default_complement text NOT NULL DEFAULT '',
  default_latitude double precision,
  default_longitude double precision,
  loyalty_points integer NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  active boolean NOT NULL DEFAULT true,
  auth_provider text NOT NULL DEFAULT 'cpf_pin'
    CHECK (auth_provider IN ('cpf_pin', 'google', 'hybrid')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_customer_accounts_org_cpf_unique
  ON sf_customer_accounts (organization_id, cpf_hash);

CREATE UNIQUE INDEX IF NOT EXISTS sf_customer_accounts_org_google_unique
  ON sf_customer_accounts (organization_id, google_subject)
  WHERE google_subject IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_customer_accounts_org_phone_idx
  ON sf_customer_accounts (organization_id, phone_normalized);

CREATE INDEX IF NOT EXISTS sf_customer_accounts_org_email_idx
  ON sf_customer_accounts (organization_id, email_normalized)
  WHERE email_normalized <> '';

CREATE INDEX IF NOT EXISTS sf_customer_accounts_org_active_idx
  ON sf_customer_accounts (organization_id, active, updated_at DESC);


CREATE TABLE IF NOT EXISTS sf_customers_state (
  organization_id uuid PRIMARY KEY
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  ready boolean NOT NULL DEFAULT false,
  source text,
  accounts_count integer NOT NULL DEFAULT 0 CHECK (accounts_count >= 0),
  imported_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
