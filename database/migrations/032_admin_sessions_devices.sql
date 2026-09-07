BEGIN;

CREATE TABLE IF NOT EXISTS sf_admin_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL
    REFERENCES sf_users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  session_version integer NOT NULL
    CHECK (session_version >= 1),
  auth_source text NOT NULL
    CHECK (auth_source IN ('cpf', 'email', 'google', 'commercial', 'demo')),
  superadmin_authorized boolean NOT NULL DEFAULT false,
  device_label text NOT NULL,
  user_agent_hash text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason text
);

CREATE INDEX IF NOT EXISTS sf_admin_sessions_user_active_idx
  ON sf_admin_sessions (
    user_id,
    last_seen_at DESC
  )
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS sf_admin_sessions_expiry_idx
  ON sf_admin_sessions (expires_at)
  WHERE revoked_at IS NULL;

INSERT INTO sf_schema_migrations (version)
VALUES ('032_admin_sessions_devices')
ON CONFLICT (version) DO NOTHING;

COMMIT;
