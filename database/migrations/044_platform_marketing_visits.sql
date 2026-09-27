BEGIN;

-- Apenas sessões anônimas da página institucional. Nenhum IP, email ou usuário.
CREATE TABLE IF NOT EXISTS sf_platform_marketing_visits (
  page text NOT NULL CHECK (page IN ('inicio', 'planos', 'demo')),
  session_id uuid NOT NULL,
  visited_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Fortaleza')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page, session_id, visited_on)
);

CREATE INDEX IF NOT EXISTS sf_platform_marketing_visits_date_idx
  ON sf_platform_marketing_visits (visited_on DESC, page);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'saborflow_rls_app') THEN
    GRANT SELECT, INSERT ON sf_platform_marketing_visits TO saborflow_rls_app;
  END IF;
END $$;

COMMIT;
