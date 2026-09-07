BEGIN;

CREATE TABLE IF NOT EXISTS sf_user_passkeys (
  credential_id text PRIMARY KEY,
  user_id uuid NOT NULL
    REFERENCES sf_users(id) ON DELETE CASCADE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0
    CHECK (counter >= 0),
  transports jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(transports) = 'array'),
  device_type text NOT NULL DEFAULT 'singleDevice'
    CHECK (device_type IN ('singleDevice', 'multiDevice')),
  backed_up boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS sf_user_passkeys_user_created_idx
  ON sf_user_passkeys (user_id, created_at DESC);

INSERT INTO sf_schema_migrations (version)
VALUES ('030_admin_passkeys')
ON CONFLICT (version) DO NOTHING;

COMMIT;
