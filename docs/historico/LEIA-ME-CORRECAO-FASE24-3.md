# SaborFlow — Correção FASE 24.3

## Objetivo

Remover escrita idempotente durante a leitura do onboarding comercial após a ativação do RLS definitivo.

A tabela `sf_organization_onboarding` já é provisionada pelas migrations/fluxos de criação de organização. O dashboard não deve executar `INSERT ... ON CONFLICT DO NOTHING` em uma operação de leitura.

## Alteração funcional

- `lib/commercial-onboarding.ts`
  - `ensureOnboardingRow()` passa a validar a existência da linha com `SELECT` dentro do escopo RLS do tenant.
  - Se a linha estiver ausente, falha de forma explícita em vez de tentar reparar dados durante GET/render.
  - Nenhum bypass RLS é introduzido.
  - `FORCE ROW LEVEL SECURITY` permanece ativo.

## Migration

Nenhuma migration nesta correção.
