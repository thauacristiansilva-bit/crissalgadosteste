# Hotfix Etapa 4 - Build Railway

Corrige o erro TypeScript em `app/admin/page.tsx` ao acessar `session.userId` em uma união que também admite sessão `legacy`.

A checagem de aceite legal agora é executada apenas em sessões `tenant`, que possuem `userId`.

- Sem migration
- Sem dependência nova
- Sem alteração de banco
- Sem alteração de Google Login
