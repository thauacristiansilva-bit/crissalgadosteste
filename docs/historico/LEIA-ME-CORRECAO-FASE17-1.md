# Correção Fase 17.1 — raiz institucional no domínio da plataforma

Corrige a prioridade de resolução da rota `/`.

Antes, qualquer host encontrado em `sf_organization_domains` podia assumir a raiz e renderizar uma loja, inclusive o hostname legado do Railway. Isso fazia o cardápio de uma organização existente aparecer no site institucional.

Agora:

- `*.up.railway.app` é sempre tratado como domínio da plataforma;
- `APP_BASE_URL`, `NEXT_PUBLIC_APP_URL` e `RAILWAY_PUBLIC_DOMAIN` também são reconhecidos como hosts da plataforma quando configurados;
- `localhost` permanece institucional em desenvolvimento;
- somente domínio próprio de loja, diferente dos hosts da plataforma, pode renderizar storefront na raiz;
- `/loja/{slug}` continua sendo a rota explícita das lojas.

Não há migration.
