BEGIN;

-- FASE 24.5
-- Reconcilia organizações existentes que, por caminhos legados/transicionais,
-- ficaram sem a linha 1:1 de sf_organization_onboarding.
--
-- A migration roda fora do runtime HTTP e usa bypass LOCAL apenas dentro desta
-- transação de manutenção. O valor é descartado automaticamente no COMMIT.
SELECT set_config('app.rls_bypass', 'true', true);

DO $$
BEGIN
  IF to_regclass('public.sf_organizations') IS NULL THEN
    RAISE EXCEPTION 'sf_organizations não existe.';
  END IF;

  IF to_regclass('public.sf_organization_onboarding') IS NULL THEN
    RAISE EXCEPTION 'sf_organization_onboarding não existe. A migration 014 precisa estar aplicada.';
  END IF;
END
$$;

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
  GREATEST(COALESCE(o.onboarding_version, 3), 3),
  CASE
    WHEN o.onboarding_status = 'complete' THEN 'published'
    ELSE 'business'
  END,
  CASE
    WHEN o.onboarding_status = 'complete'
      THEN '["business","brand","hours","fulfillment","catalog","publish"]'::jsonb
    ELSE '[]'::jsonb
  END,
  COALESCE(o.created_at, now()),
  CASE
    WHEN o.onboarding_status = 'complete'
      THEN COALESCE(o.onboarding_completed_at, now())
    ELSE NULL
  END,
  CASE
    WHEN o.onboarding_status = 'complete'
      THEN COALESCE(o.onboarding_completed_at, now())
    ELSE NULL
  END,
  now()
FROM sf_organizations AS o
LEFT JOIN sf_organization_onboarding AS ob
  ON ob.organization_id = o.id
WHERE ob.organization_id IS NULL
ON CONFLICT (organization_id) DO NOTHING;

-- Uma organização marcada como complete é, por definição do onboarding v3,
-- uma organização que terminou o fluxo. Corrigimos apenas estados incoerentes
-- já existentes; organizações pending/trial continuam intocadas.
UPDATE sf_organization_onboarding AS ob
SET
  version = GREATEST(ob.version, 3),
  current_step = 'published',
  completed_steps = '["business","brand","hours","fulfillment","catalog","publish"]'::jsonb,
  completed_at = COALESCE(ob.completed_at, o.onboarding_completed_at, now()),
  published_at = COALESCE(ob.published_at, o.onboarding_completed_at, now()),
  updated_at = now()
FROM sf_organizations AS o
WHERE o.id = ob.organization_id
  AND o.onboarding_status = 'complete'
  AND (
    ob.current_step <> 'published'
    OR ob.completed_at IS NULL
    OR ob.published_at IS NULL
  );

DO $$
DECLARE
  missing_rows integer;
BEGIN
  SELECT COUNT(*)::integer
  INTO missing_rows
  FROM sf_organizations AS o
  LEFT JOIN sf_organization_onboarding AS ob
    ON ob.organization_id = o.id
  WHERE ob.organization_id IS NULL;

  IF missing_rows <> 0 THEN
    RAISE EXCEPTION 'Ainda existem % organizações sem sf_organization_onboarding após a reconciliação.', missing_rows;
  END IF;
END
$$;

COMMIT;
