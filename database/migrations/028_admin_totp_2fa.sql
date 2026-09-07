BEGIN;

CREATE TABLE IF NOT EXISTS sf_user_mfa (
  user_id uuid PRIMARY KEY
    REFERENCES sf_users(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'totp'
    CHECK (method IN ('totp')),
  secret_encrypted text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  last_totp_step bigint,
  recovery_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(recovery_code_hashes) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_user_mfa_enabled_idx
  ON sf_user_mfa (enabled, updated_at DESC);

INSERT INTO sf_schema_migrations (version)
VALUES ('028_admin_totp_2fa')
ON CONFLICT (version) DO NOTHING;

COMMIT;
