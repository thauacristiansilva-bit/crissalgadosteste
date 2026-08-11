BEGIN;

CREATE TABLE IF NOT EXISTS sf_coupons (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  code text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL CHECK (type IN ('percent', 'fixed')),
  value numeric(12, 2) NOT NULL CHECK (value >= 0),
  minimum_order numeric(12, 2) NOT NULL DEFAULT 0 CHECK (minimum_order >= 0),
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_coupons_org_code_unique
  ON sf_coupons (organization_id, lower(code));

CREATE INDEX IF NOT EXISTS sf_coupons_org_active_idx
  ON sf_coupons (organization_id, active, updated_at DESC);


CREATE TABLE IF NOT EXISTS sf_feedbacks (
  organization_id uuid NOT NULL,
  id integer NOT NULL CHECK (id > 0),
  order_id integer NOT NULL CHECK (order_id > 0),
  order_reference text NOT NULL,
  customer_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  reaction text NOT NULL,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id),
  CONSTRAINT sf_feedbacks_order_fk
    FOREIGN KEY (organization_id, order_id)
    REFERENCES sf_orders (organization_id, id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_feedbacks_org_order_unique
  ON sf_feedbacks (organization_id, order_id);

CREATE INDEX IF NOT EXISTS sf_feedbacks_org_created_idx
  ON sf_feedbacks (organization_id, created_at DESC);


CREATE TABLE IF NOT EXISTS sf_cash_sessions (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  opened_at timestamptz NOT NULL,
  opened_by text NOT NULL,
  opening_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  closed_at timestamptz,
  closing_amount numeric(12, 2) CHECK (closing_amount IS NULL OR closing_amount >= 0),
  notes text NOT NULL DEFAULT '',
  PRIMARY KEY (organization_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_cash_sessions_one_open_per_org
  ON sf_cash_sessions (organization_id)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS sf_cash_sessions_org_opened_idx
  ON sf_cash_sessions (organization_id, opened_at DESC);


CREATE TABLE IF NOT EXISTS sf_financial_entries (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id)
);

CREATE INDEX IF NOT EXISTS sf_financial_entries_org_created_idx
  ON sf_financial_entries (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS sf_financial_entries_org_type_idx
  ON sf_financial_entries (organization_id, type, created_at DESC);


CREATE TABLE IF NOT EXISTS sf_delivery_zones (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  name text NOT NULL,
  color text NOT NULL,
  fee numeric(12, 2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  active boolean NOT NULL DEFAULT true,
  shape text NOT NULL CHECK (shape IN ('polygon', 'circle')),
  points jsonb NOT NULL DEFAULT '[]'::jsonb,
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  radius_meters integer NOT NULL CHECK (radius_meters >= 50),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id),
  CONSTRAINT sf_delivery_zones_points_array
    CHECK (jsonb_typeof(points) = 'array')
);

CREATE INDEX IF NOT EXISTS sf_delivery_zones_org_active_fee_idx
  ON sf_delivery_zones (organization_id, active, fee, id);


CREATE TABLE IF NOT EXISTS sf_couriers (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  name text NOT NULL,
  phone text NOT NULL,
  vehicle text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id)
);

CREATE INDEX IF NOT EXISTS sf_couriers_org_active_name_idx
  ON sf_couriers (organization_id, active, name);


CREATE TABLE IF NOT EXISTS sf_operations_state (
  organization_id uuid PRIMARY KEY
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  ready boolean NOT NULL DEFAULT false,
  source text,
  coupons_count integer NOT NULL DEFAULT 0 CHECK (coupons_count >= 0),
  feedbacks_count integer NOT NULL DEFAULT 0 CHECK (feedbacks_count >= 0),
  cash_sessions_count integer NOT NULL DEFAULT 0 CHECK (cash_sessions_count >= 0),
  financial_entries_count integer NOT NULL DEFAULT 0 CHECK (financial_entries_count >= 0),
  delivery_zones_count integer NOT NULL DEFAULT 0 CHECK (delivery_zones_count >= 0),
  couriers_count integer NOT NULL DEFAULT 0 CHECK (couriers_count >= 0),
  imported_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
