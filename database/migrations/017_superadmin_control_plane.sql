BEGIN;

CREATE TABLE IF NOT EXISTS sf_platform_admins (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE
    REFERENCES sf_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'operator'
    CHECK (role IN ('owner', 'operator', 'support', 'finance')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_platform_admins_status_idx
  ON sf_platform_admins (status, role, created_at DESC);

CREATE TABLE IF NOT EXISTS sf_commercial_coupons (
  id uuid PRIMARY KEY,
  code text NOT NULL,
  description text NOT NULL DEFAULT '',
  discount_type text NOT NULL
    CHECK (discount_type IN ('percent', 'fixed')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  currency text NOT NULL DEFAULT 'BRL',
  active boolean NOT NULL DEFAULT true,
  valid_from timestamptz,
  valid_until timestamptz,
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions >= 0),
  redemption_count integer NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  plan_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_platform_admin_id uuid
    REFERENCES sf_platform_admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from),
  CHECK (discount_type <> 'percent' OR discount_value <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_commercial_coupons_code_unique
  ON sf_commercial_coupons (lower(code));

CREATE INDEX IF NOT EXISTS sf_commercial_coupons_active_idx
  ON sf_commercial_coupons (active, valid_until, created_at DESC);

CREATE TABLE IF NOT EXISTS sf_support_cases (
  id uuid PRIMARY KEY,
  billing_account_id uuid
    REFERENCES sf_billing_accounts(id) ON DELETE SET NULL,
  organization_id uuid
    REFERENCES sf_organizations(id) ON DELETE SET NULL,
  subject text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  assigned_platform_admin_id uuid
    REFERENCES sf_platform_admins(id) ON DELETE SET NULL,
  created_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS sf_support_cases_status_idx
  ON sf_support_cases (status, priority, updated_at DESC);

CREATE INDEX IF NOT EXISTS sf_support_cases_account_idx
  ON sf_support_cases (billing_account_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS sf_platform_admin_actions (
  id uuid PRIMARY KEY,
  platform_admin_id uuid NOT NULL
    REFERENCES sf_platform_admins(id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_platform_admin_actions_created_idx
  ON sf_platform_admin_actions (created_at DESC);

CREATE INDEX IF NOT EXISTS sf_platform_admin_actions_target_idx
  ON sf_platform_admin_actions (target_type, target_id, created_at DESC);

-- Estas tabelas pertencem ao control plane da plataforma, não a um tenant.
-- Elas NÃO recebem a policy tenant da Fase 10. O acesso é exclusivamente por
-- rotas server-side que exigem um registro ativo em sf_platform_admins.

COMMIT;
