-- Etapa 14.5
-- Permissoes do backend autenticado do Superadmin para gerenciar tutoriais.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'saborflow_rls_app'
  ) THEN
    GRANT SELECT
      ON TABLE sf_help_categories
      TO saborflow_rls_app;

    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE sf_help_articles
      TO saborflow_rls_app;
  END IF;
END
$$;