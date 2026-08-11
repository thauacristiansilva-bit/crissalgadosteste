BEGIN;

CREATE TABLE IF NOT EXISTS sf_users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text,
  cpf text,
  phone text,
  google_subject text,
  password_hash text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'blocked', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_users_email_unique
  ON sf_users (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sf_users_cpf_unique
  ON sf_users (cpf)
  WHERE cpf IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sf_users_google_subject_unique
  ON sf_users (google_subject)
  WHERE google_subject IS NOT NULL;


CREATE TABLE IF NOT EXISTS sf_organizations (
  id uuid PRIMARY KEY,
  person_type text NOT NULL
    CHECK (person_type IN ('PF', 'PJ')),
  document text NOT NULL,
  trade_name text NOT NULL,
  legal_name text,
  slug text NOT NULL,
  industry text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_organizations_document_unique
  ON sf_organizations (document);

CREATE UNIQUE INDEX IF NOT EXISTS sf_organizations_slug_unique
  ON sf_organizations (lower(slug));


CREATE TABLE IF NOT EXISTS sf_memberships (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES sf_users(id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN (
      'owner',
      'admin',
      'manager',
      'cashier',
      'kitchen',
      'courier',
      'member'
    )),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS sf_memberships_user_idx
  ON sf_memberships (user_id);

CREATE INDEX IF NOT EXISTS sf_memberships_org_idx
  ON sf_memberships (organization_id);


CREATE TABLE IF NOT EXISTS sf_organization_settings (
  organization_id uuid PRIMARY KEY
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  locale text NOT NULL DEFAULT 'pt-BR',
  currency text NOT NULL DEFAULT 'BRL',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS sf_audit_log (
  id uuid PRIMARY KEY,
  organization_id uuid
    REFERENCES sf_organizations(id) ON DELETE SET NULL,
  user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_audit_log_org_created_idx
  ON sf_audit_log (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sf_audit_log_user_created_idx
  ON sf_audit_log (user_id, created_at DESC);


CREATE TABLE IF NOT EXISTS sf_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
