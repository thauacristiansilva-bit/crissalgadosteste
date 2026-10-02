BEGIN;

CREATE TABLE IF NOT EXISTS sf_mfa_delivery_contacts (
  user_id uuid NOT NULL REFERENCES sf_users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel)
);

CREATE TABLE IF NOT EXISTS sf_mfa_delivery_codes (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES sf_users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  purpose text NOT NULL CHECK (purpose IN ('enroll', 'login')),
  recipient text NOT NULL,
  binding_hash text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  sent_at timestamptz,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS sf_mfa_delivery_codes_user_created
  ON sf_mfa_delivery_codes (user_id, created_at DESC);

ALTER TABLE sf_mfa_delivery_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_mfa_delivery_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE sf_mfa_delivery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_mfa_delivery_codes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sf_mfa_delivery_user ON sf_mfa_delivery_contacts;
CREATE POLICY sf_mfa_delivery_user ON sf_mfa_delivery_contacts
  USING (user_id = sf_current_user_id() OR sf_rls_bypass_enabled())
  WITH CHECK (user_id = sf_current_user_id() OR sf_rls_bypass_enabled());
DROP POLICY IF EXISTS sf_mfa_delivery_user ON sf_mfa_delivery_codes;
CREATE POLICY sf_mfa_delivery_user ON sf_mfa_delivery_codes
  USING (user_id = sf_current_user_id() OR sf_rls_bypass_enabled())
  WITH CHECK (user_id = sf_current_user_id() OR sf_rls_bypass_enabled());

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'saborflow_rls_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON sf_mfa_delivery_contacts, sf_mfa_delivery_codes TO saborflow_rls_app;
  END IF;
END $$;

INSERT INTO sf_schema_migrations (version)
VALUES ('045_admin_delivery_codes') ON CONFLICT (version) DO NOTHING;
COMMIT;
