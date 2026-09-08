BEGIN;

CREATE TABLE IF NOT EXISTS sf_auth_rate_limits (
  key_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sf_auth_rate_limits_reset_at
  ON sf_auth_rate_limits (reset_at);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'saborflow_rls_app'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON sf_auth_rate_limits
      TO saborflow_rls_app;
  END IF;
END
$$;

COMMIT;