BEGIN;

ALTER TABLE sf_plans
  ADD COLUMN IF NOT EXISTS semiannual_price_cents integer
    CHECK (semiannual_price_cents IS NULL OR semiannual_price_cents >= 0);

ALTER TABLE sf_subscriptions
  DROP CONSTRAINT IF EXISTS sf_subscriptions_billing_cycle_check;
ALTER TABLE sf_subscriptions
  ADD CONSTRAINT sf_subscriptions_billing_cycle_check
  CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'semiannual', 'annual', 'manual'));

ALTER TABLE sf_checkout_sessions
  DROP CONSTRAINT IF EXISTS sf_checkout_sessions_billing_cycle_check;
ALTER TABLE sf_checkout_sessions
  ADD CONSTRAINT sf_checkout_sessions_billing_cycle_check
  CHECK (billing_cycle IN ('monthly', 'semiannual', 'annual'));

-- Mantém uma oferta pública simples: um sistema completo, com três compromissos comerciais.
UPDATE sf_plans
SET checkout_enabled = false, updated_at = now()
WHERE internal = false;

-- Se já existir um plano chamado "completo", reaproveita o mesmo ID para não quebrar referências.
UPDATE sf_plans
SET
  name = 'SaborFlow Completo',
  description = 'Gestão completa para negócios de alimentação. IA de configuração é um adicional opcional.',
  currency = 'BRL',
  monthly_price_cents = 9990,
  semiannual_price_cents = 53940,
  annual_price_cents = 95880,
  active = true,
  internal = false,
  checkout_enabled = true,
  sort_order = 10,
  metadata = COALESCE(metadata, '{}'::jsonb) || '{"pricingModel":"single-plan","trialDays":7,"aiAddonSeparate":true}'::jsonb,
  provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) || '{"commitment":{"monthly":1,"semiannual":6,"annual":12},"earlyTerminationPenaltyPercent":30}'::jsonb,
  updated_at = now()
WHERE lower(code) = 'completo';

INSERT INTO sf_plans (
  id, code, name, description, currency,
  monthly_price_cents, semiannual_price_cents, annual_price_cents,
  active, internal, checkout_enabled, sort_order, metadata, provider_metadata
)
SELECT
  md5('saborflow-plan:completo')::uuid,
  'completo',
  'SaborFlow Completo',
  'Gestão completa para negócios de alimentação. IA de configuração é um adicional opcional.',
  'BRL',
  9990,
  53940,
  95880,
  true,
  false,
  true,
  10,
  '{"pricingModel":"single-plan","trialDays":7,"aiAddonSeparate":true}'::jsonb,
  '{"commitment":{"monthly":1,"semiannual":6,"annual":12},"earlyTerminationPenaltyPercent":30}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM sf_plans WHERE lower(code) = 'completo');

WITH selected_plan AS (
  SELECT id FROM sf_plans WHERE lower(code) = 'completo' LIMIT 1
)
INSERT INTO sf_plan_entitlements (plan_id, entitlement_key, entitlement_value)
SELECT selected_plan.id, entitlement_key, entitlement_value
FROM selected_plan
CROSS JOIN (VALUES
  ('maxOrganizations', '1'::jsonb),
  ('maxUsers', 'null'::jsonb),
  ('maxProducts', 'null'::jsonb),
  ('customDomain', 'true'::jsonb),
  ('delivery', 'true'::jsonb),
  ('kitchen', 'true'::jsonb),
  ('financial', 'true'::jsonb),
  ('loyalty', 'true'::jsonb),
  ('modifiers', 'true'::jsonb),
  ('inventory', 'true'::jsonb),
  ('advancedReports', 'true'::jsonb),
  ('integrations', 'true'::jsonb),
  ('aiSetup', 'false'::jsonb)
) AS entitlements(entitlement_key, entitlement_value)
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET
  entitlement_value = EXCLUDED.entitlement_value,
  updated_at = now();

COMMIT;
