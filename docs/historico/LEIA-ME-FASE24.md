# SaborFlow — FASE 24 — PostgreSQL RLS definitivo

Esta fase ativa o isolamento tenant no PostgreSQL e substitui o rollout `prepared-only` iniciado na Fase 10 por enforcement real.

## Migration

`database/migrations/023_definitive_postgres_rls.sql`

A migration:

- cria o papel de runtime `saborflow_rls_app` como `NOLOGIN`, `NOSUPERUSER` e `NOBYPASSRLS`;
- habilita e força RLS (`ENABLE` + `FORCE ROW LEVEL SECURITY`) nas tabelas tenant com `organization_id`;
- mantém políticas especiais para memberships e tokens de autenticação;
- registra três exceções de control plane que não representam dados operacionais de um tenant;
- mantém o acesso corporativo multiunidade somente por escopo explícito do backend.

## Compatibilidade de deploy

O novo `lib/postgres.ts` detecta se o papel da Fase 24 já existe. Antes da migration 023, ele continua usando o comportamento anterior. Após a migration, em até poucos segundos, o runtime passa a executar consultas com `SET ROLE saborflow_rls_app`.

Isso permite o fluxo seguro: deploy do código -> migration 023 -> health checks.

## Health

Após a migration:

`/api/admin/rls-health`

O resultado esperado inclui:

- `ok: true`
- `runtimeRole.roleAvailable: true`
- `rollout.enforcement: "enabled-and-forced"`
- `isolationProbe.currentTenantVisible: true`
- `isolationProbe.sameTenantHiddenWithoutScope: true`
- `boundaries.postgresRlsIsEnforced: true`

O antigo `/api/admin/security-health` também passa a aceitar o estado definitivo da Fase 24.

## Importante

Não use `git add .`. Publique somente os arquivos funcionais indicados na conversa.
