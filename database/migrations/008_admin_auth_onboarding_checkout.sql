BEGIN;

ALTER TABLE sf_users
  ADD COLUMN IF NOT EXISTS password_updated_at timestamptz;

ALTER TABLE sf_users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

ALTER TABLE sf_organizations
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid
    REFERENCES sf_users(id) ON DELETE SET NULL;

ALTER TABLE sf_organizations
  ADD COLUMN IF NOT EXISTS onboarding_version integer NOT NULL DEFAULT 1
    CHECK (onboarding_version >= 1);

CREATE INDEX IF NOT EXISTS sf_organizations_created_by_user_idx
  ON sf_organizations (created_by_user_id, created_at DESC);

COMMIT;
