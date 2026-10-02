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
    'integrations',
    'aiSetup'
  ));

-- A IA de configuração é um recurso adicional. Mantemos desativada por padrão
-- nos planos comuns; contas legadas existentes permanecem liberadas.
INSERT INTO sf_plan_entitlements (plan_id, entitlement_key, entitlement_value)
SELECT
  id,
  'aiSetup',
  CASE WHEN code = 'legacy-existing' THEN 'true'::jsonb ELSE 'false'::jsonb END
FROM sf_plans
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET
  entitlement_value = EXCLUDED.entitlement_value,
  updated_at = now();

COMMIT;
