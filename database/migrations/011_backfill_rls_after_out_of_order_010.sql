BEGIN;

-- Reparação para instalações em que a migration 010 foi aplicada antes da 009.
-- A 010 cria as tabelas normalmente, mas só prepara RLS quando a infraestrutura
-- da 009 (sf_current_organization_id + sf_rls_rollout) já existe.
DO $$
DECLARE
  target_table text;
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
  IF to_regprocedure('sf_current_organization_id()') IS NULL
     OR to_regclass('public.sf_rls_rollout') IS NULL THEN
    RAISE EXCEPTION 'Migration 009_security_team_domain_rls deve ser aplicada antes desta reparacao';
  END IF;

  FOREACH target_table IN ARRAY tenant_tables
  LOOP
    IF to_regclass('public.' || target_table) IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = target_table
          AND policyname = 'sf_tenant_guard'
      ) THEN
        EXECUTE format(
          'CREATE POLICY sf_tenant_guard ON %I USING (organization_id = sf_current_organization_id()) WITH CHECK (organization_id = sf_current_organization_id())',
          target_table
        );
      END IF;

      -- Mantém o comportamento das Fases 10-12: políticas preparadas, enforcement desligado.
      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', target_table);

      INSERT INTO sf_rls_rollout (
        table_name,
        policy_name,
        prepared,
        enforcement,
        updated_at
      )
      VALUES (
        target_table,
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
    END IF;
  END LOOP;
END
$$;

COMMIT;
