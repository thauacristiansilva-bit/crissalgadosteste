# SaborFlow — Correção FASE 24.2

## Objetivo

Corrigir o erro de renderização do `/admin` após a ativação do RLS definitivo.

O log de produção mostrou:

`new row violates row-level security policy for table "sf_organization_onboarding"`

A leitura do onboarding executa um bootstrap idempotente (`INSERT ... ON CONFLICT DO NOTHING`) para garantir a existência da linha de `sf_organization_onboarding`. Com o RLS definitivo, essa escrita precisa executar dentro de um escopo tenant explícito.

## Alteração

Arquivo funcional alterado:

- `lib/commercial-onboarding.ts`

O bootstrap de onboarding passa a usar `runWithTenantRlsScope([organizationId], ...)`, preservando o `user_id` do contexto atual quando disponível.

## Segurança

- não desativa RLS;
- não remove `FORCE ROW LEVEL SECURITY`;
- não usa bypass privilegiado;
- não amplia o tenant scope;
- não possui migration;
- mantém a linha de onboarding limitada à organização autenticada.

## Instalação

Extraia na raiz do projeto e rode o build. Faça commit apenas de `lib/commercial-onboarding.ts`.

Não rode novamente a migration `023_definitive_postgres_rls.sql`.
