BEGIN;

ALTER TABLE sf_admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_admin_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sf_admin_sessions_user_guard
  ON sf_admin_sessions;

CREATE POLICY sf_admin_sessions_user_guard
ON sf_admin_sessions
FOR ALL
USING (
  sf_rls_bypass_enabled()
  OR user_id = sf_current_user_id()
)
WITH CHECK (
  sf_rls_bypass_enabled()
  OR user_id = sf_current_user_id()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'saborflow_rls_app'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON sf_admin_sessions
      TO saborflow_rls_app;
  END IF;
END
$$;

INSERT INTO sf_schema_migrations (version)
VALUES ('035_admin_sessions_rls')
ON CONFLICT (version) DO NOTHING;

COMMIT;
