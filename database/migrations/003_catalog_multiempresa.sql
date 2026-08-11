BEGIN;

CREATE TABLE IF NOT EXISTS sf_categories (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_categories_org_name_unique
  ON sf_categories (organization_id, lower(name));

CREATE INDEX IF NOT EXISTS sf_categories_org_active_sort_idx
  ON sf_categories (organization_id, active, sort_order, id);


CREATE TABLE IF NOT EXISTS sf_products (
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  id integer NOT NULL CHECK (id > 0),
  category_id integer NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  image text NOT NULL DEFAULT '',
  track_stock boolean NOT NULL DEFAULT false,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  CONSTRAINT sf_products_category_fk
    FOREIGN KEY (organization_id, category_id)
    REFERENCES sf_categories (organization_id, id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS sf_products_org_active_category_idx
  ON sf_products (organization_id, active, category_id, id);

CREATE INDEX IF NOT EXISTS sf_products_org_featured_idx
  ON sf_products (organization_id, featured DESC, id);


CREATE TABLE IF NOT EXISTS sf_catalog_state (
  organization_id uuid PRIMARY KEY
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  ready boolean NOT NULL DEFAULT false,
  source text,
  categories_count integer NOT NULL DEFAULT 0 CHECK (categories_count >= 0),
  products_count integer NOT NULL DEFAULT 0 CHECK (products_count >= 0),
  imported_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
