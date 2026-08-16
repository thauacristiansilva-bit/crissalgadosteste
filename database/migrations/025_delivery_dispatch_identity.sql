BEGIN;

-- FASE 25.3: vincula o perfil operacional de entregador ao colaborador/log-in
-- sem duplicar identidade no pedido. O pedido continua referenciando sf_couriers;
-- a identidade do usuário é resolvida via sf_staff_members.user_id.
ALTER TABLE sf_couriers
  ADD COLUMN IF NOT EXISTS staff_member_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sf_couriers_staff_member_fk'
      AND conrelid = 'public.sf_couriers'::regclass
  ) THEN
    ALTER TABLE sf_couriers
      ADD CONSTRAINT sf_couriers_staff_member_fk
      FOREIGN KEY (organization_id, staff_member_id)
      REFERENCES sf_staff_members (organization_id, id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS sf_couriers_org_staff_unique
  ON sf_couriers (organization_id, staff_member_id)
  WHERE staff_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_couriers_org_staff_active_idx
  ON sf_couriers (organization_id, staff_member_id, active)
  WHERE staff_member_id IS NOT NULL;

-- A tabela já fazia parte do rollout definitivo da Fase 24. Reafirmamos
-- explicitamente as garantias para que a migration seja segura mesmo se for
-- executada em um banco restaurado ou com rollout parcialmente refeito.
DROP POLICY IF EXISTS sf_tenant_guard ON sf_couriers;
CREATE POLICY sf_tenant_guard ON sf_couriers
  USING (sf_rls_tenant_allowed(organization_id))
  WITH CHECK (sf_rls_tenant_allowed(organization_id));

ALTER TABLE sf_couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_couriers FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON sf_couriers TO saborflow_rls_app;

INSERT INTO sf_rls_rollout (
  table_name,
  policy_name,
  prepared,
  enforcement,
  updated_at
)
VALUES (
  'sf_couriers',
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

COMMIT;
