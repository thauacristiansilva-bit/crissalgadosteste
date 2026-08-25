# SaborFlow — Correção FASE 24.6

## Objetivo
Unificar a `AsyncLocalStorage` usada pelo contexto RLS entre chunks server/SSR do Next.js/Turbopack.

## Diagnóstico confirmado
- A organização e o onboarding existem.
- O papel `saborflow_rls_app` enxerga ambos quando `app.organization_id` / `app.organization_ids` são configurados diretamente.
- O health da Fase 24 passa com 45/45 tabelas.
- O `/admin` falha como se estivesse sem escopo, e billing retorna `users/products = 0`.

Isso é compatível com múltiplas instâncias do módulo `rls-context.ts` em chunks server diferentes, cada uma com sua própria `AsyncLocalStorage`.

## Correção
`lib/rls-context.ts` passa a armazenar a instância de `AsyncLocalStorage` em `globalThis.__saborflowRlsContextStorage`.

Assim, `auth.ts`, SSR, APIs e `postgres.ts` compartilham o mesmo contexto no processo Node.

## Segurança
- Não desativa RLS.
- Não remove FORCE RLS.
- Não altera policies.
- Não usa bypass.
- Não possui migration.
