BEGIN;

ALTER TABLE sf_user_mfa
  ADD COLUMN IF NOT EXISTS
    pending_secret_encrypted text;

ALTER TABLE sf_user_mfa
  ADD COLUMN IF NOT EXISTS
    pending_secret_created_at timestamptz;

INSERT INTO sf_schema_migrations (
  version
)
VALUES (
  '029_admin_2fa_recovery_management'
)
ON CONFLICT (version)
DO NOTHING;

COMMIT;
