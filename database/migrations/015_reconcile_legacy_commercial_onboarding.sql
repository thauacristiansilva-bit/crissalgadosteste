BEGIN;

-- Fase 15.1
-- Reconcilia organizações que já existiam antes da implantação do onboarding
-- comercial v3. Essas lojas não devem ser obrigadas a refazer onboarding.
DO $$
DECLARE
  phase15_applied_at timestamptz;
BEGIN
  SELECT applied_at
  INTO phase15_applied_at
  FROM sf_schema_migrations
  WHERE version = '014_commercial_onboarding'
  LIMIT 1;

  IF phase15_applied_at IS NULL THEN
    RAISE EXCEPTION 'A migration 014_commercial_onboarding precisa estar aplicada antes da 015.';
  END IF;

  UPDATE sf_organizations AS o
  SET
    onboarding_status = 'complete',
    onboarding_completed_at = COALESCE(o.onboarding_completed_at, phase15_applied_at),
    onboarding_version = GREATEST(COALESCE(o.onboarding_version, 1), 3),
    updated_at = now()
  WHERE o.created_at <= phase15_applied_at;

  INSERT INTO sf_organization_onboarding (
    organization_id,
    version,
    current_step,
    completed_steps,
    started_at,
    completed_at,
    published_at,
    updated_at
  )
  SELECT
    o.id,
    3,
    'published',
    '["business","brand","hours","fulfillment","catalog","publish"]'::jsonb,
    o.created_at,
    COALESCE(o.onboarding_completed_at, phase15_applied_at),
    COALESCE(o.onboarding_completed_at, phase15_applied_at),
    now()
  FROM sf_organizations AS o
  WHERE o.created_at <= phase15_applied_at
  ON CONFLICT (organization_id)
  DO UPDATE SET
    version = GREATEST(sf_organization_onboarding.version, EXCLUDED.version),
    current_step = 'published',
    completed_steps = EXCLUDED.completed_steps,
    completed_at = COALESCE(sf_organization_onboarding.completed_at, EXCLUDED.completed_at),
    published_at = COALESCE(sf_organization_onboarding.published_at, EXCLUDED.published_at),
    updated_at = now();
END
$$;

COMMIT;
