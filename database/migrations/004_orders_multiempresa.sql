BEGIN;

CREATE TABLE IF NOT EXISTS sf_orders (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  code text NOT NULL,
  reference text NOT NULL,
  type text NOT NULL
    CHECK (type IN ('pickup', 'delivery')),
  status text NOT NULL
    CHECK (status IN (
      'pending',
      'accepted',
      'preparing',
      'ready',
      'in-route',
      'completed',
      'cancelled'
    )),
  channel text NOT NULL
    CHECK (channel IN ('WEB', 'PDV', 'APP')),
  subtotal numeric(12, 2) NOT NULL CHECK (subtotal >= 0),
  discount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  coupon_code text,
  delivery_fee numeric(12, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total numeric(12, 2) NOT NULL CHECK (total >= 0),
  payment_status text NOT NULL
    CHECK (payment_status IN ('paid', 'unpaid')),
  payment_method text NOT NULL
    CHECK (payment_method IN ('card', 'cash', 'pix')),
  change_for text,
  notes text,
  customer jsonb NOT NULL DEFAULT '{}'::jsonb,
  courier_id integer,
  courier_name text,
  delivery_zone_id integer,
  delivery_zone_name text,
  requested_for timestamptz NOT NULL,
  scheduled boolean NOT NULL DEFAULT false,
  printed_at timestamptz,
  source text NOT NULL DEFAULT 'legacy',
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_orders_org_reference_unique
  ON sf_orders (organization_id, lower(reference));

CREATE INDEX IF NOT EXISTS sf_orders_org_created_idx
  ON sf_orders (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS sf_orders_org_status_requested_idx
  ON sf_orders (organization_id, status, requested_for, id);

CREATE INDEX IF NOT EXISTS sf_orders_org_payment_idx
  ON sf_orders (organization_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS sf_orders_org_customer_phone_idx
  ON sf_orders (organization_id, ((customer ->> 'phone')));


CREATE TABLE IF NOT EXISTS sf_order_items (
  organization_id uuid NOT NULL,
  order_id integer NOT NULL,
  line_no integer NOT NULL CHECK (line_no > 0),
  product_id integer NOT NULL CHECK (product_id > 0),
  name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal numeric(12, 2) NOT NULL CHECK (subtotal >= 0),
  PRIMARY KEY (organization_id, order_id, line_no),
  CONSTRAINT sf_order_items_order_fk
    FOREIGN KEY (organization_id, order_id)
    REFERENCES sf_orders (organization_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sf_order_items_org_product_idx
  ON sf_order_items (organization_id, product_id);


CREATE TABLE IF NOT EXISTS sf_orders_state (
  organization_id uuid PRIMARY KEY
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  ready boolean NOT NULL DEFAULT false,
  source text,
  orders_count integer NOT NULL DEFAULT 0 CHECK (orders_count >= 0),
  items_count integer NOT NULL DEFAULT 0 CHECK (items_count >= 0),
  total_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  imported_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
