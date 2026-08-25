# SaborFlow — Correção FASE 24.4.1

Corrige exclusivamente o import TypeScript de `OrganizationRole` em `lib/tenant-admin-data.ts`.

A Fase 24.4 importava esse tipo de `@/lib/rls-context`, mas o tipo é exportado por `@/lib/tenant-context`.

Não há migration. O comportamento de RLS da Fase 24.4 permanece inalterado.
