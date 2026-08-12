BEGIN;

CREATE TABLE IF NOT EXISTS sf_billing_accounts (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL
    REFERENCES sf_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'closed')),
  billing_email text,
  entitlement_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id)
);

CREATE INDEX IF NOT EXISTS sf_billing_accounts_status_idx
  ON sf_billing_accounts (status, created_at DESC);


CREATE TABLE IF NOT EXISTS sf_plans (
  id uuid PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'BRL',
  monthly_price_cents integer
    CHECK (monthly_price_cents IS NULL OR monthly_price_cents >= 0),
  annual_price_cents integer
    CHECK (annual_price_cents IS NULL OR annual_price_cents >= 0),
  active boolean NOT NULL DEFAULT true,
  internal boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_plans_code_unique
  ON sf_plans (lower(code));

CREATE INDEX IF NOT EXISTS sf_plans_public_idx
  ON sf_plans (active, internal, sort_order, name);


CREATE TABLE IF NOT EXISTS sf_plan_entitlements (
  plan_id uuid NOT NULL
    REFERENCES sf_plans(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL
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
      'advancedReports'
    )),
  entitlement_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, entitlement_key)
);


CREATE TABLE IF NOT EXISTS sf_subscriptions (
  id uuid PRIMARY KEY,
  billing_account_id uuid NOT NULL
    REFERENCES sf_billing_accounts(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL
    REFERENCES sf_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'trialing',
      'active',
      'past_due',
      'suspended',
      'canceled'
    )),
  billing_cycle text
    CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual', 'manual')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  activated_at timestamptz,
  canceled_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_subscriptions_provider_unique
  ON sf_subscriptions (provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sf_subscriptions_current_account_unique
  ON sf_subscriptions (billing_account_id)
  WHERE status IN ('trialing', 'active', 'past_due', 'suspended');

CREATE INDEX IF NOT EXISTS sf_subscriptions_account_created_idx
  ON sf_subscriptions (billing_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sf_subscriptions_status_idx
  ON sf_subscriptions (status, current_period_end);


CREATE TABLE IF NOT EXISTS sf_subscription_events (
  id uuid PRIMARY KEY,
  billing_account_id uuid NOT NULL
    REFERENCES sf_billing_accounts(id) ON DELETE CASCADE,
  subscription_id uuid
    REFERENCES sf_subscriptions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  provider_event_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_subscription_events_provider_unique
  ON sf_subscription_events (source, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_subscription_events_account_created_idx
  ON sf_subscription_events (billing_account_id, created_at DESC);


CREATE TABLE IF NOT EXISTS sf_usage_counters (
  id uuid PRIMARY KEY,
  billing_account_id uuid NOT NULL
    REFERENCES sf_billing_accounts(id) ON DELETE CASCADE,
  organization_id uuid
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  counter_key text NOT NULL,
  period_key text NOT NULL DEFAULT 'lifetime',
  value bigint NOT NULL DEFAULT 0 CHECK (value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_usage_counters_scope_unique
  ON sf_usage_counters (
    billing_account_id,
    COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    counter_key,
    period_key
  );

CREATE INDEX IF NOT EXISTS sf_usage_counters_account_idx
  ON sf_usage_counters (billing_account_id, counter_key, period_key);


ALTER TABLE sf_organizations
  ADD COLUMN IF NOT EXISTS billing_account_id uuid
    REFERENCES sf_billing_accounts(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS sf_organizations_billing_account_idx
  ON sf_organizations (billing_account_id, status, created_at DESC);


-- Plano interno de compatibilidade. Não é exibido para contratação.
-- maxOrganizations recebe override por conta para ficar exatamente no uso atual.
INSERT INTO sf_plans (
  id,
  code,
  name,
  description,
  active,
  internal,
  sort_order,
  metadata
)
VALUES (
  md5('saborflow-plan:legacy-existing')::uuid,
  'legacy-existing',
  'Compatibilidade existente',
  'Plano interno para preservar contas existentes até a contratação comercial definitiva.',
  true,
  true,
  -100,
  '{"bootstrap":true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  active = true,
  internal = true,
  updated_at = now();

INSERT INTO sf_plan_entitlements (plan_id, entitlement_key, entitlement_value)
VALUES
  (md5('saborflow-plan:legacy-existing')::uuid, 'maxOrganizations', '1'::jsonb),
  (md5('saborflow-plan:legacy-existing')::uuid, 'maxUsers', 'null'::jsonb),
  (md5('saborflow-plan:legacy-existing')::uuid, 'maxProducts', 'null'::jsonb),
  (md5('saborflow-plan:legacy-existing')::uuid, 'customDomain', 'true'::jsonb),
  (md5('saborflow-plan:legacy-existing')::uuid, 'delivery', 'true'::jsonb),
  (md5('saborflow-plan:legacy-existing')::uuid, 'kitchen', 'true'::jsonb),
  (md5('saborflow-plan:legacy-existing')::uuid, 'financial', 'true'::jsonb),
  (md5('saborflow-plan:legacy-existing')::uuid, 'loyalty', 'true'::jsonb),
  (md5('saborflow-plan:legacy-existing')::uuid, 'modifiers', 'true'::jsonb),
  (md5('saborflow-plan:legacy-existing')::uuid, 'inventory', 'true'::jsonb),
  (md5('saborflow-plan:legacy-existing')::uuid, 'advancedReports', 'true'::jsonb)
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET
  entitlement_value = EXCLUDED.entitlement_value,
  updated_at = now();


-- Cria uma conta contratante para cada usuário que já é proprietário de pelo menos uma organização.
INSERT INTO sf_billing_accounts (
  id,
  owner_user_id,
  billing_email,
  entitlement_overrides,
  metadata
)
SELECT
  md5('saborflow-billing-account:' || u.id::text)::uuid,
  u.id,
  u.email,
  jsonb_build_object(
    'maxOrganizations',
    GREATEST(COUNT(DISTINCT m.organization_id), 1)
  ),
  '{"bootstrap":"phase-13"}'::jsonb
FROM sf_users u
INNER JOIN sf_memberships m
  ON m.user_id = u.id
 AND m.role = 'owner'
 AND m.status = 'active'
GROUP BY u.id, u.email
ON CONFLICT (owner_user_id) DO NOTHING;

-- Compatibilidade para organizações antigas sem membership owner consistente, mas com criador conhecido.
INSERT INTO sf_billing_accounts (
  id,
  owner_user_id,
  billing_email,
  entitlement_overrides,
  metadata
)
SELECT
  md5('saborflow-billing-account:' || u.id::text)::uuid,
  u.id,
  u.email,
  jsonb_build_object(
    'maxOrganizations',
    GREATEST(COUNT(DISTINCT o.id), 1)
  ),
  '{"bootstrap":"phase-13-created-by"}'::jsonb
FROM sf_users u
INNER JOIN sf_organizations o
  ON o.created_by_user_id = u.id
WHERE NOT EXISTS (
  SELECT 1
  FROM sf_billing_accounts existing
  WHERE existing.owner_user_id = u.id
)
GROUP BY u.id, u.email
ON CONFLICT (owner_user_id) DO NOTHING;


-- Vincula cada organização ao primeiro owner ativo. Se não houver owner, usa o criador quando possível.
WITH preferred_owner AS (
  SELECT DISTINCT ON (o.id)
    o.id AS organization_id,
    COALESCE(m.user_id, o.created_by_user_id) AS owner_user_id
  FROM sf_organizations o
  LEFT JOIN sf_memberships m
    ON m.organization_id = o.id
   AND m.role = 'owner'
   AND m.status = 'active'
  WHERE o.billing_account_id IS NULL
    AND COALESCE(m.user_id, o.created_by_user_id) IS NOT NULL
  ORDER BY o.id, m.created_at ASC NULLS LAST
)
UPDATE sf_organizations o
SET
  billing_account_id = ba.id,
  updated_at = now()
FROM preferred_owner po
INNER JOIN sf_billing_accounts ba
  ON ba.owner_user_id = po.owner_user_id
WHERE o.id = po.organization_id
  AND o.billing_account_id IS NULL;


-- Garante que o override de lojas não fique abaixo da quantidade já vinculada.
UPDATE sf_billing_accounts ba
SET
  entitlement_overrides = jsonb_set(
    COALESCE(ba.entitlement_overrides, '{}'::jsonb),
    '{maxOrganizations}',
    to_jsonb(GREATEST(COALESCE(usage.used_count, 0), 1)),
    true
  ),
  updated_at = now()
FROM (
  SELECT
    billing_account_id,
    COUNT(*)::integer AS used_count
  FROM sf_organizations
  WHERE billing_account_id IS NOT NULL
    AND status <> 'cancelled'
  GROUP BY billing_account_id
) usage
WHERE usage.billing_account_id = ba.id;


-- Cada conta existente recebe uma assinatura ativa interna. Ela preserva o serviço,
-- mas não aumenta limites além do uso atual de lojas.
INSERT INTO sf_subscriptions (
  id,
  billing_account_id,
  plan_id,
  status,
  billing_cycle,
  provider,
  activated_at,
  metadata
)
SELECT
  md5('saborflow-subscription:legacy:' || ba.id::text)::uuid,
  ba.id,
  md5('saborflow-plan:legacy-existing')::uuid,
  'active',
  'manual',
  'internal',
  now(),
  '{"bootstrap":"phase-13"}'::jsonb
FROM sf_billing_accounts ba
WHERE NOT EXISTS (
  SELECT 1
  FROM sf_subscriptions s
  WHERE s.billing_account_id = ba.id
    AND s.status IN ('trialing', 'active', 'past_due', 'suspended')
)
ON CONFLICT (id) DO NOTHING;


INSERT INTO sf_subscription_events (
  id,
  billing_account_id,
  subscription_id,
  event_type,
  source,
  payload
)
SELECT
  md5('saborflow-subscription-event:legacy:' || s.id::text)::uuid,
  s.billing_account_id,
  s.id,
  'subscription.bootstrap_active',
  'system',
  '{"phase":13,"reason":"preserve-existing-account"}'::jsonb
FROM sf_subscriptions s
WHERE s.provider = 'internal'
  AND s.status = 'active'
ON CONFLICT (id) DO NOTHING;

COMMIT;
