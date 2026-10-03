-- SaborFlow - Etapa 12
-- Publicacoes programadas + flyers para Instagram e WhatsApp Status.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sf_marketing_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  created_by uuid,
  title text NOT NULL,
  channel text NOT NULL
    CHECK (channel IN ('instagram_feed', 'instagram_story', 'whatsapp_status')),
  content_type text NOT NULL DEFAULT 'flyer'
    CHECK (content_type IN ('flyer', 'image', 'video', 'text')),
  caption text NOT NULL DEFAULT '',
  cta text NOT NULL DEFAULT '',
  media_url text,
  template_key text,
  flyer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz,
  recurrence text NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly')),
  recurrence_days smallint[] NOT NULL DEFAULT ARRAY[]::smallint[],
  recurrence_time time without time zone,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'scheduled', 'published', 'cancelled', 'failed')),
  active boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_marketing_publications_title_check
    CHECK (char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT sf_marketing_publications_caption_check
    CHECK (char_length(caption) <= 5000),
  CONSTRAINT sf_marketing_publications_cta_check
    CHECK (char_length(cta) <= 160),
  CONSTRAINT sf_marketing_publications_recurrence_days_check
    CHECK (recurrence_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
);

CREATE INDEX IF NOT EXISTS sf_marketing_publications_org_schedule_idx
  ON sf_marketing_publications (organization_id, active, scheduled_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS sf_marketing_publications_org_status_idx
  ON sf_marketing_publications (organization_id, status, updated_at DESC);

DROP POLICY IF EXISTS sf_tenant_guard ON sf_marketing_publications;

CREATE POLICY sf_tenant_guard
ON sf_marketing_publications
USING (
  sf_rls_tenant_allowed(organization_id)
)
WITH CHECK (
  sf_rls_tenant_allowed(organization_id)
);

ALTER TABLE sf_marketing_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_marketing_publications FORCE ROW LEVEL SECURITY;

INSERT INTO sf_rls_rollout (
  table_name,
  policy_name,
  prepared,
  enforcement,
  updated_at
)
VALUES (
  'sf_marketing_publications',
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
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'saborflow_rls_app'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE sf_marketing_publications
      TO saborflow_rls_app;
  END IF;
END
$$;

COMMIT;
