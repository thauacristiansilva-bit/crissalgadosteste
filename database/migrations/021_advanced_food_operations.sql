BEGIN;

CREATE TABLE IF NOT EXISTS sf_ingredient_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  ingredient_id integer NOT NULL CHECK (ingredient_id > 0),
  lot_code text NOT NULL,
  supplier text NOT NULL DEFAULT '',
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  expires_at date,
  quantity_received numeric(14, 3) NOT NULL CHECK (quantity_received > 0),
  quantity_discarded numeric(14, 3) NOT NULL DEFAULT 0 CHECK (quantity_discarded >= 0),
  unit_cost numeric(14, 4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'discarded')),
  note text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_ingredient_lots_ingredient_fk
    FOREIGN KEY (organization_id, ingredient_id)
    REFERENCES sf_ingredients (organization_id, id)
    ON DELETE RESTRICT,
  CHECK (quantity_discarded <= quantity_received)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_ingredient_lots_org_ingredient_code_unique
  ON sf_ingredient_lots (organization_id, ingredient_id, lower(lot_code));

CREATE INDEX IF NOT EXISTS sf_ingredient_lots_org_expiry_idx
  ON sf_ingredient_lots (organization_id, status, expires_at, received_at DESC);

CREATE TABLE IF NOT EXISTS sf_food_production_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  product_id integer NOT NULL CHECK (product_id > 0),
  batch_code text NOT NULL,
  produced_at timestamptz NOT NULL DEFAULT now(),
  planned_yield numeric(14, 3) NOT NULL CHECK (planned_yield > 0),
  actual_yield numeric(14, 3) NOT NULL CHECK (actual_yield > 0),
  waste_quantity numeric(14, 3) NOT NULL DEFAULT 0 CHECK (waste_quantity >= 0),
  recipe_items_count integer NOT NULL DEFAULT 0 CHECK (recipe_items_count >= 0),
  theoretical_unit_cost numeric(14, 4) NOT NULL DEFAULT 0 CHECK (theoretical_unit_cost >= 0),
  theoretical_batch_cost numeric(14, 4) NOT NULL DEFAULT 0 CHECK (theoretical_batch_cost >= 0),
  effective_unit_cost numeric(14, 4) NOT NULL DEFAULT 0 CHECK (effective_unit_cost >= 0),
  yield_efficiency numeric(8, 3) NOT NULL DEFAULT 0 CHECK (yield_efficiency >= 0),
  note text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_food_production_runs_product_fk
    FOREIGN KEY (organization_id, product_id)
    REFERENCES sf_products (organization_id, id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_food_production_runs_org_batch_unique
  ON sf_food_production_runs (organization_id, lower(batch_code));

CREATE INDEX IF NOT EXISTS sf_food_production_runs_org_date_idx
  ON sf_food_production_runs (organization_id, produced_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS sf_inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  reference text NOT NULL,
  note text NOT NULL DEFAULT '',
  counted_by_user_id uuid REFERENCES sf_users(id) ON DELETE SET NULL,
  counted_at timestamptz NOT NULL DEFAULT now(),
  total_items integer NOT NULL DEFAULT 0 CHECK (total_items >= 0),
  adjusted_items integer NOT NULL DEFAULT 0 CHECK (adjusted_items >= 0),
  value_difference numeric(14, 4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_inventory_counts_org_date_idx
  ON sf_inventory_counts (organization_id, counted_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS sf_inventory_count_items (
  count_id uuid NOT NULL
    REFERENCES sf_inventory_counts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  ingredient_id integer NOT NULL CHECK (ingredient_id > 0),
  system_quantity numeric(14, 3) NOT NULL CHECK (system_quantity >= 0),
  counted_quantity numeric(14, 3) NOT NULL CHECK (counted_quantity >= 0),
  quantity_difference numeric(14, 3) NOT NULL,
  unit_cost_snapshot numeric(14, 4) NOT NULL DEFAULT 0 CHECK (unit_cost_snapshot >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (count_id, ingredient_id),
  CONSTRAINT sf_inventory_count_items_ingredient_fk
    FOREIGN KEY (organization_id, ingredient_id)
    REFERENCES sf_ingredients (organization_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS sf_inventory_count_items_org_ingredient_idx
  ON sf_inventory_count_items (organization_id, ingredient_id, created_at DESC);

-- A ativação definitiva do PostgreSQL RLS continua reservada para a FASE 24.
ALTER TABLE sf_ingredient_lots DISABLE ROW LEVEL SECURITY;
ALTER TABLE sf_food_production_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE sf_inventory_counts DISABLE ROW LEVEL SECURITY;
ALTER TABLE sf_inventory_count_items DISABLE ROW LEVEL SECURITY;

COMMIT;
