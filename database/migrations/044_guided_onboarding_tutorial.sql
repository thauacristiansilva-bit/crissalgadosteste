BEGIN;

ALTER TABLE sf_organization_onboarding
  ADD COLUMN IF NOT EXISTS guide_mode text;

ALTER TABLE sf_organization_onboarding
  ADD COLUMN IF NOT EXISTS guide_choice_at timestamptz;

ALTER TABLE sf_organization_onboarding
  DROP CONSTRAINT IF EXISTS sf_organization_onboarding_guide_mode_check;

ALTER TABLE sf_organization_onboarding
  ADD CONSTRAINT sf_organization_onboarding_guide_mode_check
  CHECK (guide_mode IS NULL OR guide_mode IN ('guided', 'self'));

-- A versão 4 separa a localização dos dados comerciais para deixar o tutorial
-- mais simples e didático para novos usuários.
ALTER TABLE sf_organization_onboarding
  DROP CONSTRAINT IF EXISTS sf_organization_onboarding_current_step_check;

ALTER TABLE sf_organization_onboarding
  ADD CONSTRAINT sf_organization_onboarding_current_step_check
  CHECK (current_step IN (
    'business',
    'brand',
    'location',
    'hours',
    'fulfillment',
    'catalog',
    'publish',
    'published'
  ));

UPDATE sf_organization_onboarding
SET version = GREATEST(version, 4)
WHERE version < 4;

COMMIT;
