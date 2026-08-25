# SaborFlow — Correção Fase 25.3.2.1

## Problema
Ao clicar em **Criar login** para um colaborador existente, a API podia responder `Colaborador não encontrado.`.

O cadastro estava correto. O problema era que `/api/admin/team/access` ainda dependia do contexto RLS implícito da sessão. A criação do convite abre uma conexão transacional própria; com `FORCE ROW LEVEL SECURITY`, a consulta a `sf_staff_members` deve receber escopo tenant explicitamente.

## Correção
`app/api/admin/team/access/route.ts` agora executa GET, POST e DELETE dentro de `runWithTenantRlsScope([organizationId], userId, ...)`.

Isso preserva:
- PostgreSQL como autoridade;
- RLS e FORCE RLS;
- RBAC (`access.manage`);
- isolamento por organização;
- billing limit antes de adicionar novo login;
- fluxo de convite, recuperação de senha e revogação.

Não há migration e não há bypass RLS.
