-- Feedback opcional dos tutoriais interativos do painel.

BEGIN;

CREATE TABLE IF NOT EXISTS sf_tutorial_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  tutorial_id text NOT NULL,
  tutorial_title text NOT NULL DEFAULT '',
  rating smallint CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  helpful text CHECK (helpful IS NULL OR helpful IN ('yes', 'partly', 'no')),
  comment text NOT NULL DEFAULT '',
  step_count integer NOT NULL DEFAULT 0 CHECK (step_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_tutorial_feedback_org_created_idx
ON sf_tutorial_feedback (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sf_tutorial_feedback_tutorial_idx
ON sf_tutorial_feedback (tutorial_id, created_at DESC);

DROP POLICY IF EXISTS sf_tenant_guard ON sf_tutorial_feedback;
CREATE POLICY sf_tenant_guard
ON sf_tutorial_feedback
USING (sf_rls_tenant_allowed(organization_id))
WITH CHECK (sf_rls_tenant_allowed(organization_id));

ALTER TABLE sf_tutorial_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_tutorial_feedback FORCE ROW LEVEL SECURITY;

INSERT INTO sf_rls_rollout (
  table_name,
  policy_name,
  prepared,
  enforcement,
  updated_at
)
VALUES (
  'sf_tutorial_feedback',
  'sf_tenant_guard',
  true,
  'enabled',
  now()
)
ON CONFLICT (table_name)
DO UPDATE SET
  policy_name = EXCLUDED.policy_name,
  prepared = true,
  enforcement = 'enabled',
  updated_at = now();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'saborflow_rls_app') THEN
    GRANT SELECT, INSERT ON TABLE sf_tutorial_feedback TO saborflow_rls_app;
  END IF;
END
$$;

COMMIT;
