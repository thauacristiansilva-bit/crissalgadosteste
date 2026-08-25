# SaborFlow — Fase 8: Empresa, Equipe e Lojas Públicas

A Fase 8 move os últimos dados centrais da empresa para uma camada tenant-aware
e cria a resolução pública por `slug`/domínio.

## O que entra

### Configurações da empresa

`sf_organization_settings` passa a ser a fonte do Admin e da loja pública.

O `storeName`, cores, horários, redes sociais, formas de pagamento, impressão,
fidelidade, chatbot e demais configurações continuam com o mesmo formato
`StoreSettings`, agora vinculadas ao `organization_id`.

### Equipe

Cria:

- `sf_staff_members`

Os registros do painel Equipe ficam isolados por organização.

IMPORTANTE: esta tabela é o perfil operacional da equipe. O login individual de
cada colaborador ainda será ligado a `sf_users + sf_memberships` em uma próxima
fase.

### Publicação da loja

Cria:

- `sf_organization_domains`
- `sf_tenant_runtime_state`

A empresa passa a poder ser resolvida por:

- `/loja/<slug>`
- domínio mapeado

Para a Cris Salgados:

`/loja/cris-salgados`

O importador registra automaticamente `RAILWAY_PUBLIC_DOMAIN`, quando a variável
estiver disponível.

## Next.js 16

Este pacote adiciona `proxy.ts` apenas para manter o `slug` selecionado em um
cookie público ao navegar por `/loja/<slug>` no domínio compartilhado.

O cookie é:

`saborflow_store_slug`

Ele NÃO autentica ninguém. É apenas um seletor público de loja e o servidor
sempre valida o slug no PostgreSQL.

## Segurança do checkout

A Cris Salgados continua com `public_ordering_enabled = true`.

Empresas futuras nascerão com pedidos online desabilitados. A Fase 8 já permite
publicar/buscar a loja por slug, mas não deixa uma nova empresa usar por engano
o checkout legado da Cris Salgados.

O checkout multiempresa direto para novas organizações será a próxima fase.

---

## 1. Copiar pacote

Extraia o ZIP e copie todo o conteúdo para a raiz do projeto.

## 2. Build

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se falhar, NÃO faça commit.

## 3. Git

```powershell
git add database/migrations/007_tenant_runtime.sql
git add scripts/import-tenant-runtime.mjs
git add lib/organization-db.ts
git add lib/public-tenant.ts
git add lib/public-store-db.ts
git add lib/tenant-permissions.ts
git add lib/client-auth.ts
git add lib/db.ts
git add lib/tenant-admin-data.ts
git add proxy.ts
git add app/page.tsx
git add app/loja/[slug]/page.tsx
git add app/api/store/route.ts
git add app/api/public/tenant/route.ts
git add app/api/settings/route.ts
git add app/api/staff/route.ts
git add app/api/staff/[id]/route.ts
git add app/api/admin/tenant-runtime-health/route.ts
git add app/api/client/login/route.ts
git add app/api/client/register/route.ts
git add app/api/client/me/route.ts
git add app/api/client/profile/route.ts
git add app/api/client/logout/route.ts
git add app/api/coupons/route.ts
git add app/api/delivery/quote/route.ts
git add app/api/feedback/route.ts
git add app/api/orders/route.ts
git add app/api/order-status/[reference]/route.ts
git add app/pedido/[reference]/page.tsx
git add components/store/order-tracker.tsx

git status
```

Se `next-env.d.ts` aparecer modificado:

```powershell
git restore next-env.d.ts
```

Não use `git add .`.

Depois:

```powershell
git commit -m "Adicionar runtime de empresa e lojas publicas multiempresa SaborFlow"
git push origin main
```

Espere Railway `SUCCESS`.

## 4. Migration 007

No Console Railway:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado:

```text
SKIP 001_core_multiempresa - já aplicada
SKIP 002_organization_onboarding - já aplicada
SKIP 003_catalog_multiempresa - já aplicada
SKIP 004_orders_multiempresa - já aplicada
SKIP 005_customers_multiempresa - já aplicada
SKIP 006_operations_multiempresa - já aplicada
APLICANDO 007_tenant_runtime...
OK 007_tenant_runtime
```

## 5. Importar runtime

```bash
node scripts/import-tenant-runtime.mjs
```

A origem DEVE ser:

```text
/data/store.json
```

Se aparecer `store.seed.json`, pare.

Resultado esperado:

```text
SaborFlow - runtime da empresa importado com sucesso.
Empresa: Cris Salgados
Slug: cris-salgados
Organization ID: ...
Colaboradores: ...
Domínios registrados: ...
Origem: /data/store.json

Loja por slug: /loja/cris-salgados
Domínio Railway: https://...
```

Não use `--force`.

## 6. Health check

Logado no Admin:

`/api/admin/tenant-runtime-health`

Esperado:

```json
{
  "ok": true,
  "runtime": {
    "ready": true,
    "settingsReady": true,
    "staffReady": true,
    "publicReady": true
  },
  "transition": {
    "countsMatch": true
  }
}
```

## 7. Teste da loja pública

Abra:

`https://SEU-DOMINIO/loja/cris-salgados`

Depois abra no mesmo navegador:

`https://SEU-DOMINIO/api/public/tenant`

Esperado:

```json
{
  "ok": true,
  "organization": {
    "name": "Cris Salgados",
    "slug": "cris-salgados",
    "publicOrderingEnabled": true
  }
}
```

Confirme:

- produtos;
- identidade visual;
- horários;
- taxa/áreas de entrega;
- login do cliente;
- cupom;
- pedido de teste;
- acompanhamento.

A Cris Salgados deve continuar funcionando normalmente.

## 8. Teste do Admin

Altere uma informação reversível em Configurações, salve e confira a loja por
slug.

Se houver colaborador, ative/desative um registro e confirme que o painel
continua correto.

Depois confira novamente:

`/api/admin/tenant-runtime-health`

## NÃO fazer

- não apagar `/data/store.json`;
- não remover o Volume;
- não usar `--force`;
- não cadastrar outra empresa manualmente direto nas tabelas;
- não ligar `public_ordering_enabled` para uma segunda empresa ainda;
- não remover `ADMIN_EMAIL`/`ADMIN_PASSWORD` ainda.

## Próxima fase

Fase 9:

- onboarding real de nova empresa;
- criação de segunda organização;
- seletor de empresa no Admin;
- usuário com múltiplas memberships;
- ativação segura do checkout PostgreSQL para cada organização;
- início do desligamento do login legado por variáveis.
