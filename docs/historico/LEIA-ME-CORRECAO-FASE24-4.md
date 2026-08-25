# SaborFlow — Correção Fase 24.4

Corrige o carregamento do painel `/admin` após a ativação do FORCE RLS.

## Causa

A revalidação de `sf_memberships` e as consultas subsequentes do dashboard dependiam do contexto RLS ambiente criado durante a leitura da sessão. Em renderizações server-side esse contexto não deve ser tratado como autoridade implícita para toda a árvore assíncrona.

## Correção

`getTenantAwareAdminData()` agora executa todo o caminho tenant dentro de `runWithTenantRlsScope([organizationId], userId, ...)`.

A associação usuário/organização continua sendo consultada e validada. Não há bypass RLS e não há mudança de policy ou migration.

## Arquivo funcional

- `lib/tenant-admin-data.ts`

## Migration

Nenhuma.
