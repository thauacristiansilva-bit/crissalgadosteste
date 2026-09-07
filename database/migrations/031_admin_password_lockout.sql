BEGIN;

CREATE TABLE IF NOT EXISTS sf_auth_login_lockouts (
  subject_key text PRIMARY KEY,
  user_id uuid
    REFERENCES sf_users(id) ON DELETE CASCADE,
  failure_count integer NOT NULL DEFAULT 0
    CHECK (failure_count >= 0),
  locked_until timestamptz,
  last_failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_auth_login_lockouts_user_idx
  ON sf_auth_login_lockouts (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_auth_login_lockouts_updated_idx
  ON sf_auth_login_lockouts (updated_at DESC);

INSERT INTO sf_schema_migrations (version)
VALUES ('031_admin_password_lockout')
ON CONFLICT (version) DO NOTHING;

COMMIT;
