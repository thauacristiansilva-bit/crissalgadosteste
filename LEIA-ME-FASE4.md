# SaborFlow — Fase 4: catálogo multiempresa

Esta fase migra **categorias e produtos** para PostgreSQL com isolamento por
`organization_id`, sem migrar pedidos ainda.

## Resultado desta fase

No PostgreSQL:

- `sf_categories`
- `sf_products`
- `sf_catalog_state`

Toda leitura/escrita administrativa do catálogo é feita usando o
`organizationId` derivado da sessão assinada. A API não aceita
`organization_id` enviado pelo navegador.

## Compatibilidade durante a transição

Pedidos, storefront, clientes, caixa e financeiro continuam no `store.json`.

Por isso, para a **empresa atual do deployment**, alterações administrativas de
categoria/produto são espelhadas no `store.json` até a fase de pedidos.

O estoque também é sincronizado de `store.json` para PostgreSQL depois que um
pedido é criado.

Outras organizações não usam esse espelho legado.

## Segurança do rollout

Antes de a migration 003 + importação estarem prontas, o painel continua usando
o catálogo legado. Isso evita quebrar produção entre o deploy do código e a
execução da migration.

---

## 1. Copiar o ZIP para a raiz

Copie/substitua os arquivos deste pacote na raiz do projeto.

## 2. Testar build local

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se falhar, NÃO faça push.

## 3. Commit e push

```powershell
git add database/migrations/003_catalog_multiempresa.sql
git add scripts/import-catalog-multiempresa.mjs
git add lib/catalog-db.ts
git add lib/tenant-access.ts
git add lib/db.ts
git add app/api/categories/route.ts
git add app/api/categories/[id]/route.ts
git add app/api/products/route.ts
git add app/api/products/[id]/route.ts
git add app/api/admin/catalog-health/route.ts
git add app/admin/page.tsx

git status
git commit -m "Migrar catalogo para PostgreSQL multiempresa SaborFlow"
git push origin main
```

Espere o Railway ficar `SUCCESS`.

## 4. Aplicar migration 003 no Railway

No Console do serviço `crissalgadosteste`:

```bash
node scripts/migrate-multiempresa.mjs
```

Resultado esperado:

```text
SKIP 001_core_multiempresa - já aplicada
SKIP 002_organization_onboarding - já aplicada
APLICANDO 003_catalog_multiempresa...
OK 003_catalog_multiempresa
```

## 5. Importar o catálogo atual

Ainda no Console:

```bash
node scripts/import-catalog-multiempresa.mjs
```

Resultado esperado:

```text
SaborFlow - catálogo multiempresa importado com sucesso.
Empresa: Cris Salgados
Organization ID: ...
Categorias: ...
Produtos: ...
store.json não foi apagado nem alterado.
```

O script é protegido contra execução acidental repetida. Se o catálogo já
estiver marcado como pronto, ele não sobrescreve nada.

**Não use `--force` sem necessidade.**

## 6. Validar

Saia e entre novamente no Admin apenas se sua sessão tiver expirado. Depois
abra:

`https://crissalgadosteste-production.up.railway.app/api/admin/catalog-health`

Esperado:

```json
{
  "ok": true,
  "catalog": {
    "ready": true,
    "categories": 0,
    "products": 0
  },
  "transition": {
    "legacyMirrorEnabled": true
  }
}
```

Os números reais serão os do seu catálogo.

Depois abra o painel e confira:

1. Categorias;
2. Produtos;
3. Estoque;
4. ative/desative um produto de teste;
5. confirme que o site público continua exibindo o mesmo catálogo.

## NÃO fazer nesta fase

- não apagar `data/store.json`;
- não criar produtos manualmente no Railway;
- não executar `--force` sem orientação;
- não migrar pedidos ainda.

## Próxima fase

Fase 5:

- criar tabelas de pedidos e itens por `organization_id`;
- migrar histórico de pedidos;
- validar totais/quantidades;
- trocar o checkout para gravar no PostgreSQL;
- remover a dependência do catálogo legado somente depois da validação.
