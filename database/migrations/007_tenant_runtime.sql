BEGIN;

ALTER TABLE sf_organizations
  ADD COLUMN IF NOT EXISTS public_store_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE sf_organizations
  ADD COLUMN IF NOT EXISTS public_ordering_enabled boolean NOT NULL DEFAULT false;


CREATE TABLE IF NOT EXISTS sf_staff_members (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  role text NOT NULL
    CHECK (role IN ('admin', 'manager', 'cashier', 'kitchen', 'courier')),
  active boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id),
  CONSTRAINT sf_staff_members_permissions_array
    CHECK (jsonb_typeof(permissions) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_staff_members_org_email_unique
  ON sf_staff_members (organization_id, lower(email))
  WHERE email <> '';

CREATE INDEX IF NOT EXISTS sf_staff_members_org_active_role_idx
  ON sf_staff_members (organization_id, active, role, name);


CREATE TABLE IF NOT EXISTS sf_organization_domains (
  domain text PRIMARY KEY,
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  verified boolean NOT NULL DEFAULT false,
  primary_domain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_organization_domains_org_idx
  ON sf_organization_domains (
    organization_id,
    verified DESC,
    primary_domain DESC
  );


CREATE TABLE IF NOT EXISTS sf_tenant_runtime_state (
  organization_id uuid PRIMARY KEY
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  ready boolean NOT NULL DEFAULT false,
  source text,
  settings_ready boolean NOT NULL DEFAULT false,
  staff_ready boolean NOT NULL DEFAULT false,
  public_ready boolean NOT NULL DEFAULT false,
  staff_count integer NOT NULL DEFAULT 0 CHECK (staff_count >= 0),
  domains_count integer NOT NULL DEFAULT 0 CHECK (domains_count >= 0),
  imported_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
