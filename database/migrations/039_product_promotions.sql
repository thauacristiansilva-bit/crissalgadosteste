-- Etapa 14.8.1
-- Promocoes de produto com recorrencia semanal e RLS por tenant.

BEGIN;

CREATE TABLE IF NOT EXISTS sf_product_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES sf_organizations(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  promotional_price numeric(12,2) NOT NULL
    CHECK (promotional_price > 0),
  starts_on date,
  ends_on date,
  days_of_week smallint[] NOT NULL
    DEFAULT ARRAY[0,1,2,3,4,5,6]::smallint[],
  start_time time without time zone NOT NULL
    DEFAULT '00:00',
  end_time time without time zone NOT NULL
    DEFAULT '23:59',
  recurring_weekly boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  highlight boolean NOT NULL DEFAULT true,
  label text NOT NULL DEFAULT 'Oferta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sf_product_promotions_product_fk
    FOREIGN KEY (organization_id, product_id)
    REFERENCES sf_products (organization_id, id)
    ON DELETE CASCADE,

  CONSTRAINT sf_product_promotions_dates_check
    CHECK (
      starts_on IS NULL
      OR ends_on IS NULL
      OR ends_on >= starts_on
    ),

  CONSTRAINT sf_product_promotions_days_check
    CHECK (
      cardinality(days_of_week) > 0
      AND days_of_week <@
        ARRAY[0,1,2,3,4,5,6]::smallint[]
    ),

  CONSTRAINT sf_product_promotions_time_check
    CHECK (end_time > start_time),

  CONSTRAINT sf_product_promotions_label_check
    CHECK (char_length(label) BETWEEN 1 AND 40)
);

CREATE INDEX IF NOT EXISTS
  sf_product_promotions_org_product_idx
ON sf_product_promotions (
  organization_id,
  product_id,
  active,
  updated_at DESC
);

CREATE INDEX IF NOT EXISTS
  sf_product_promotions_org_active_idx
ON sf_product_promotions (
  organization_id,
  active,
  starts_on,
  ends_on
);

DROP POLICY IF EXISTS
  sf_tenant_guard
ON sf_product_promotions;

CREATE POLICY sf_tenant_guard
ON sf_product_promotions
USING (
  sf_rls_tenant_allowed(organization_id)
)
WITH CHECK (
  sf_rls_tenant_allowed(organization_id)
);

ALTER TABLE sf_product_promotions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE sf_product_promotions
  FORCE ROW LEVEL SECURITY;

INSERT INTO sf_rls_rollout (
  table_name,
  policy_name,
  prepared,
  enforcement,
  updated_at
)
VALUES (
  'sf_product_promotions',
  'sf_tenant_guard',
  true,
  'enabled',
  now()
)
ON CONFLICT (table_name)
DO UPDATE SET
  policy_name = EXCLUDED.policy_name,
  prepared = true,
  enforcement = 'enabled',
  updated_at = now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'saborflow_rls_app'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE sf_product_promotions
      TO saborflow_rls_app;
  END IF;
END
$$;

COMMIT;
