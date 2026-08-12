BEGIN;

CREATE TABLE IF NOT EXISTS sf_modifier_groups (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  required boolean NOT NULL DEFAULT false,
  min_select integer NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select integer NOT NULL DEFAULT 1 CHECK (max_select > 0),
  included_quantity integer NOT NULL DEFAULT 0 CHECK (included_quantity >= 0),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  CHECK (min_select <= max_select),
  CHECK (included_quantity <= max_select)
);

CREATE INDEX IF NOT EXISTS sf_modifier_groups_org_active_sort_idx
  ON sf_modifier_groups (organization_id, active, sort_order, id);


CREATE TABLE IF NOT EXISTS sf_modifier_options (
  organization_id uuid NOT NULL,
  id integer NOT NULL CHECK (id > 0),
  group_id integer NOT NULL CHECK (group_id > 0),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_delta numeric(12, 2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
  included_eligible boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  CONSTRAINT sf_modifier_options_group_fk
    FOREIGN KEY (organization_id, group_id)
    REFERENCES sf_modifier_groups (organization_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sf_modifier_options_org_group_sort_idx
  ON sf_modifier_options (organization_id, group_id, active, sort_order, id);


CREATE TABLE IF NOT EXISTS sf_product_modifier_groups (
  organization_id uuid NOT NULL,
  product_id integer NOT NULL CHECK (product_id > 0),
  group_id integer NOT NULL CHECK (group_id > 0),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY (organization_id, product_id, group_id),
  CONSTRAINT sf_product_modifier_groups_product_fk
    FOREIGN KEY (organization_id, product_id)
    REFERENCES sf_products (organization_id, id)
    ON DELETE CASCADE,
  CONSTRAINT sf_product_modifier_groups_group_fk
    FOREIGN KEY (organization_id, group_id)
    REFERENCES sf_modifier_groups (organization_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sf_product_modifier_groups_org_product_sort_idx
  ON sf_product_modifier_groups (organization_id, product_id, sort_order, group_id);


CREATE TABLE IF NOT EXISTS sf_ingredients (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  name text NOT NULL,
  unit text NOT NULL
    CHECK (unit IN ('g', 'kg', 'ml', 'l', 'unit', 'portion')),
  stock_quantity numeric(14, 3) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  min_stock_quantity numeric(14, 3) NOT NULL DEFAULT 0 CHECK (min_stock_quantity >= 0),
  unit_cost numeric(14, 4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_ingredients_org_name_unique
  ON sf_ingredients (organization_id, lower(name));

CREATE INDEX IF NOT EXISTS sf_ingredients_org_active_stock_idx
  ON sf_ingredients (organization_id, active, stock_quantity, id);


CREATE TABLE IF NOT EXISTS sf_product_ingredients (
  organization_id uuid NOT NULL,
  product_id integer NOT NULL CHECK (product_id > 0),
  ingredient_id integer NOT NULL CHECK (ingredient_id > 0),
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, product_id, ingredient_id),
  CONSTRAINT sf_product_ingredients_product_fk
    FOREIGN KEY (organization_id, product_id)
    REFERENCES sf_products (organization_id, id)
    ON DELETE CASCADE,
  CONSTRAINT sf_product_ingredients_ingredient_fk
    FOREIGN KEY (organization_id, ingredient_id)
    REFERENCES sf_ingredients (organization_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS sf_product_ingredients_org_ingredient_idx
  ON sf_product_ingredients (organization_id, ingredient_id, product_id);


CREATE TABLE IF NOT EXISTS sf_modifier_option_ingredients (
  organization_id uuid NOT NULL,
  option_id integer NOT NULL CHECK (option_id > 0),
  ingredient_id integer NOT NULL CHECK (ingredient_id > 0),
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, option_id, ingredient_id),
  CONSTRAINT sf_modifier_option_ingredients_option_fk
    FOREIGN KEY (organization_id, option_id)
    REFERENCES sf_modifier_options (organization_id, id)
    ON DELETE CASCADE,
  CONSTRAINT sf_modifier_option_ingredients_ingredient_fk
    FOREIGN KEY (organization_id, ingredient_id)
    REFERENCES sf_ingredients (organization_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS sf_modifier_option_ingredients_org_ingredient_idx
  ON sf_modifier_option_ingredients (organization_id, ingredient_id, option_id);


CREATE TABLE IF NOT EXISTS sf_order_item_modifiers (
  organization_id uuid NOT NULL,
  order_id integer NOT NULL CHECK (order_id > 0),
  line_no integer NOT NULL CHECK (line_no > 0),
  modifier_no integer NOT NULL CHECK (modifier_no > 0),
  group_id integer NOT NULL CHECK (group_id > 0),
  group_name text NOT NULL,
  option_id integer NOT NULL CHECK (option_id > 0),
  option_name text NOT NULL,
  price_delta numeric(12, 2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
  included boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, order_id, line_no, modifier_no),
  CONSTRAINT sf_order_item_modifiers_item_fk
    FOREIGN KEY (organization_id, order_id, line_no)
    REFERENCES sf_order_items (organization_id, order_id, line_no)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sf_order_item_modifiers_org_order_idx
  ON sf_order_item_modifiers (organization_id, order_id, line_no, modifier_no);


CREATE TABLE IF NOT EXISTS sf_inventory_movements (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  ingredient_id integer NOT NULL CHECK (ingredient_id > 0),
  kind text NOT NULL
    CHECK (kind IN ('sale', 'reversal', 'manual_in', 'manual_out', 'adjustment', 'waste')),
  quantity_delta numeric(14, 3) NOT NULL CHECK (quantity_delta <> 0),
  unit_cost_snapshot numeric(14, 4) NOT NULL DEFAULT 0 CHECK (unit_cost_snapshot >= 0),
  order_id integer,
  source_key text,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_inventory_movements_ingredient_fk
    FOREIGN KEY (organization_id, ingredient_id)
    REFERENCES sf_ingredients (organization_id, id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_inventory_movements_org_source_unique
  ON sf_inventory_movements (organization_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_inventory_movements_org_ingredient_created_idx
  ON sf_inventory_movements (organization_id, ingredient_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS sf_inventory_movements_org_order_idx
  ON sf_inventory_movements (organization_id, order_id)
  WHERE order_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS sf_food_composition_state (
  organization_id uuid PRIMARY KEY
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  ready boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'migration',
  modifier_groups_count integer NOT NULL DEFAULT 0 CHECK (modifier_groups_count >= 0),
  modifier_options_count integer NOT NULL DEFAULT 0 CHECK (modifier_options_count >= 0),
  ingredients_count integer NOT NULL DEFAULT 0 CHECK (ingredients_count >= 0),
  recipe_items_count integer NOT NULL DEFAULT 0 CHECK (recipe_items_count >= 0),
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sf_food_composition_state (
  organization_id,
  ready,
  source,
  modifier_groups_count,
  modifier_options_count,
  ingredients_count,
  recipe_items_count,
  imported_at,
  updated_at
)
SELECT
  o.id,
  true,
  'migration-010',
  0,
  0,
  0,
  0,
  now(),
  now()
FROM sf_organizations o
ON CONFLICT (organization_id)
DO UPDATE SET
  ready = true,
  source = 'migration-010',
  updated_at = now();


-- Prepara RLS para as novas tabelas, sem ativar enforcement nesta fase.
DO $$
DECLARE
  table_name text;
  tenant_tables text[] := ARRAY[
    'sf_modifier_groups',
    'sf_modifier_options',
    'sf_product_modifier_groups',
    'sf_ingredients',
    'sf_product_ingredients',
    'sf_modifier_option_ingredients',
    'sf_order_item_modifiers',
    'sf_inventory_movements',
    'sf_food_composition_state'
  ];
BEGIN
  IF to_regprocedure('sf_current_organization_id()') IS NOT NULL
     AND to_regclass('public.sf_rls_rollout') IS NOT NULL THEN
    FOREACH table_name IN ARRAY tenant_tables
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = table_name
          AND policyname = 'sf_tenant_guard'
      ) THEN
        EXECUTE format(
          'CREATE POLICY sf_tenant_guard ON %I USING (organization_id = sf_current_organization_id()) WITH CHECK (organization_id = sf_current_organization_id())',
          table_name
        );
      END IF;

      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_name);

      INSERT INTO sf_rls_rollout (
        table_name,
        policy_name,
        prepared,
        enforcement,
        updated_at
      )
      VALUES (
        table_name,
        'sf_tenant_guard',
        true,
        'prepared',
        now()
      )
      ON CONFLICT (table_name)
      DO UPDATE SET
        policy_name = EXCLUDED.policy_name,
        prepared = true,
        enforcement = 'prepared',
        updated_at = now();
    END LOOP;
  END IF;
END
$$;

COMMIT;
