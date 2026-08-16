BEGIN;

-- FASE 25.3.2: dados complementares do perfil do colaborador.
-- A identidade, as permissões e o vínculo tenant continuam na própria
-- sf_staff_members; não criamos nova autoridade nem tabela fora do RLS.
ALTER TABLE sf_staff_members
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sf_staff_members_employment_type_check'
      AND conrelid = 'public.sf_staff_members'::regclass
  ) THEN
    ALTER TABLE sf_staff_members
      ADD CONSTRAINT sf_staff_members_employment_type_check
      CHECK (
        employment_type IS NULL OR
        employment_type IN ('employee', 'contractor', 'temporary', 'partner', 'other')
      );
  END IF;
END
$$;

-- Reafirma as garantias da Fase 24 sobre a tabela já protegida.
DROP POLICY IF EXISTS sf_tenant_guard ON sf_staff_members;
CREATE POLICY sf_tenant_guard ON sf_staff_members
  USING (sf_rls_tenant_allowed(organization_id))
  WITH CHECK (sf_rls_tenant_allowed(organization_id));

ALTER TABLE sf_staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_staff_members FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON sf_staff_members TO saborflow_rls_app;

INSERT INTO sf_rls_rollout (
  table_name,
  policy_name,
  prepared,
  enforcement,
  updated_at
)
VALUES (
  'sf_staff_members',
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
