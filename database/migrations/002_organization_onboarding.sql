BEGIN;

ALTER TABLE sf_organizations
  ALTER COLUMN person_type DROP NOT NULL;

ALTER TABLE sf_organizations
  ALTER COLUMN document DROP NOT NULL;

ALTER TABLE sf_organizations
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'pending'
    CHECK (onboarding_status IN ('pending', 'complete'));

ALTER TABLE sf_organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMIT;
