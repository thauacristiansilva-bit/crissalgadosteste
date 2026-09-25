BEGIN;

CREATE TABLE IF NOT EXISTS sf_product_recommendations (
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  recommended_product_id integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, product_id, recommended_product_id),
  FOREIGN KEY (organization_id, product_id) REFERENCES sf_products(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, recommended_product_id) REFERENCES sf_products(organization_id, id) ON DELETE CASCADE,
  CHECK (product_id <> recommended_product_id)
);

CREATE INDEX IF NOT EXISTS sf_product_recommendations_lookup
  ON sf_product_recommendations (organization_id, product_id, sort_order);

DROP POLICY IF EXISTS sf_tenant_guard ON sf_product_recommendations;
CREATE POLICY sf_tenant_guard ON sf_product_recommendations
  USING (sf_rls_tenant_allowed(organization_id))
  WITH CHECK (sf_rls_tenant_allowed(organization_id));
ALTER TABLE sf_product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_product_recommendations FORCE ROW LEVEL SECURITY;

INSERT INTO sf_rls_rollout (table_name, policy_name, prepared, enforcement, updated_at)
VALUES ('sf_product_recommendations', 'sf_tenant_guard', true, 'enabled', now())
ON CONFLICT (table_name) DO UPDATE SET
  policy_name=EXCLUDED.policy_name, prepared=true, enforcement='enabled', updated_at=now();

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='saborflow_rls_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON sf_product_recommendations TO saborflow_rls_app;
  END IF;
END $$;

COMMIT;
