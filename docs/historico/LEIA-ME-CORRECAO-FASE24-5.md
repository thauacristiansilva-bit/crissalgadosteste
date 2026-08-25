# SaborFlow — Correção Fase 24.5

## Objetivo

Reconciliar organizações existentes que ficaram sem a linha obrigatória em `sf_organization_onboarding` após a transição multiempresa/RLS.

O erro observado no `/admin` é:

`Onboarding comercial não provisionado para esta organização.`

A correção não volta a fazer escrita durante um GET. Ela corrige o dado uma única vez por migration.

## Migration

`database/migrations/024_reconcile_onboarding_after_rls.sql`

A migration:

- cria a linha de onboarding apenas para organizações que não possuem uma;
- preserva organizações pendentes como `business`;
- reconcilia organizações com `onboarding_status = complete` para `published`;
- verifica no final que nenhuma organização ficou sem onboarding;
- usa `app.rls_bypass=true` somente como configuração LOCAL da transação de manutenção;
- não desabilita RLS;
- não remove `FORCE ROW LEVEL SECURITY`;
- não altera policies.

## Importante

Não execute novamente a migration `023_definitive_postgres_rls.sql`.
