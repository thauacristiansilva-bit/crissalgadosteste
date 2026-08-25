# SaborFlow — Correção FASE 25-R1.1

Correção de tipagem TypeScript em `app/api/feedback/route.ts`.

O corpo da requisição já era validado antes do callback do `runWithTenantRlsScope`, mas o TypeScript não preservava o narrowing de `body.orderReference` e `body.rating` dentro da closure assíncrona.

A correção captura os valores validados em constantes locais antes da closure.

- Sem migration.
- Sem alteração de RLS/policies.
- Sem alteração de dados.
- Sem reativar legado.
