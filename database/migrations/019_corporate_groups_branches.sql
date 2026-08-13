BEGIN;

CREATE TABLE IF NOT EXISTS sf_corporate_groups (
  id uuid PRIMARY KEY,
  billing_account_id uuid NOT NULL
    REFERENCES sf_billing_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (billing_account_id)
);

CREATE INDEX IF NOT EXISTS sf_corporate_groups_status_idx
  ON sf_corporate_groups (status, created_at DESC);


CREATE TABLE IF NOT EXISTS sf_corporate_group_organizations (
  group_id uuid NOT NULL
    REFERENCES sf_corporate_groups(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE RESTRICT,
  unit_type text NOT NULL DEFAULT 'branch'
    CHECK (unit_type IN ('headquarters', 'branch')),
  unit_code text NOT NULL DEFAULT '',
  cost_center text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, organization_id),
  UNIQUE (organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_corporate_group_one_headquarters
  ON sf_corporate_group_organizations (group_id)
  WHERE unit_type = 'headquarters';

CREATE INDEX IF NOT EXISTS sf_corporate_group_orgs_order_idx
  ON sf_corporate_group_organizations (group_id, display_order, created_at);


CREATE TABLE IF NOT EXISTS sf_corporate_group_members (
  id uuid PRIMARY KEY,
  group_id uuid NOT NULL
    REFERENCES sf_corporate_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES sf_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'analyst'
    CHECK (role IN ('owner', 'admin', 'analyst')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  created_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS sf_corporate_group_members_user_idx
  ON sf_corporate_group_members (user_id, status, group_id);


CREATE TABLE IF NOT EXISTS sf_corporate_group_audit (
  id uuid PRIMARY KEY,
  group_id uuid NOT NULL
    REFERENCES sf_corporate_groups(id) ON DELETE CASCADE,
  actor_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_corporate_group_audit_group_created_idx
  ON sf_corporate_group_audit (group_id, created_at DESC);

-- A Fase 19 mantém o enforcement PostgreSQL RLS desligado, conforme o rollout
-- preparado na Fase 10. O hardening definitivo dessas tabelas será feito na Fase 24.

COMMIT;
