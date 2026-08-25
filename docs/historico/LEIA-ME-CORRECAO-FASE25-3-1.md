# SaborFlow — correção Fase 25.3.1

## Objetivo

Remover o último fallback legado das rotas de equipe.

`/api/staff` e `/api/staff/[id]` passam a operar exclusivamente sobre PostgreSQL tenant-aware.

## Segurança

- exige sessão tenant PostgreSQL válida;
- preserva RBAC de equipe e governança de acessos;
- executa leitura/escrita dentro de `runWithTenantRlsScope`;
- se o runtime tenant não estiver pronto, falha com HTTP 503;
- nunca chama `lib/db.ts`;
- nunca chama `store.json`;
- não usa bypass RLS.

## Banco

Não há migration.
