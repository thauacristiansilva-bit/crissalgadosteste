# Hotfix Superadmin - tipagem PostgreSQL

Corrige apenas a tipagem genérica de `safeQuery` em `lib/superadmin-platform-insights.ts`.

- restringe as linhas para objetos compatíveis com o driver `pg`;
- preserva todas as consultas e métricas da Etapa 10;
- não altera banco nem exige migration.
