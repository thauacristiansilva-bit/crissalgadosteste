# SaborFlow — Fase 5: Pedidos Multiempresa

Esta fase cria o armazenamento PostgreSQL de pedidos e itens por
`organization_id`.

## O que entra no PostgreSQL

- `sf_orders`
- `sf_order_items`
- `sf_orders_state`

Cada pedido pertence obrigatoriamente a uma organização.

O `organization_id` usado por rotas administrativas vem da sessão assinada do
SaborFlow. A API não aceita `organization_id` enviado pelo navegador.

## Estratégia de transição

A Fase 5 NÃO apaga o `store.json`.

Depois que a importação estiver pronta:

- Admin / Dashboard lê pedidos do PostgreSQL;
- mudança de status/pagamento é feita no PostgreSQL;
- a empresa atual ainda recebe um espelho no `store.json`;
- novos pedidos WEB/PDV continuam passando pelas regras legadas e, após serem
  criados, são gravados também no PostgreSQL;
- acompanhamento público do pedido tenta PostgreSQL primeiro;
- fila de impressão tenta PostgreSQL primeiro.

Essa ponte existe porque clientes, cupons, delivery, caixa e outros módulos
ainda usam o arquivo legado.

---

## 1. Copiar os arquivos

Copie todo o conteúdo deste ZIP para a raiz do projeto.

## 2. Build local

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se falhar, NÃO faça commit.

## 3. Git

```powershell
git add database/migrations/004_orders_multiempresa.sql
git add scripts/import-orders-multiempresa.mjs
git add lib/order-db.ts
git add lib/tenant-admin-data.ts
git add lib/db.ts
git add app/api/orders/route.ts
git add app/api/orders/[id]/route.ts
git add app/api/orders/[id]/ticket-pdf/route.ts
git add app/api/order-status/[reference]/route.ts
git add app/pedido/[reference]/page.tsx
git add app/api/print-queue/route.ts
git add app/api/dashboard/route.ts
git add app/api/admin/orders-health/route.ts
git add app/admin/page.tsx

git status
git commit -m "Migrar pedidos para PostgreSQL multiempresa SaborFlow"
git push origin main
```

Espere o Railway ficar `SUCCESS`.

## 4. Migration 004

No Console Railway:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado:

```text
SKIP 001_core_multiempresa - já aplicada
SKIP 002_organization_onboarding - já aplicada
SKIP 003_catalog_multiempresa - já aplicada
APLICANDO 004_orders_multiempresa...
OK 004_orders_multiempresa
```

## 5. Importar histórico

Ainda no Console:

```bash
node scripts/import-orders-multiempresa.mjs
```

Antes de gravar, o script valida:

- IDs duplicados;
- referências duplicadas;
- itens sem quantidade/preço;
- subtotal dos itens;
- subtotal do pedido;
- total final.

Se encontrar divergência, ele cancela a importação e não marca a fase como
pronta.

Resultado esperado:

```text
SaborFlow - pedidos multiempresa importados com sucesso.
Empresa: Cris Salgados
Organization ID: ...
Pedidos: ...
Itens: ...
Total histórico: R$ ...
Origem: ...
store.json não foi apagado nem alterado.
```

### Atenção à origem

Se aparecer:

```text
Origem: /app/data/store.seed.json
```

e você esperava pedidos reais anteriores, NÃO avance para testes de escrita.
Envie a saída para revisão. Isso pode indicar que `DATA_FILE`/volume ainda não
está apontando para o arquivo persistente esperado.

Não use `--force`.

## 6. Verificar

Logado no Admin, abra:

`https://crissalgadosteste-production.up.railway.app/api/admin/orders-health`

O esperado é:

```json
{
  "ok": true,
  "orders": {
    "ready": true
  },
  "transition": {
    "legacyMirrorEnabled": true,
    "countsMatch": true
  }
}
```

Compare também:

- `orders.orders` com `transition.legacy.orders`;
- `orders.items` com `transition.legacy.items`;
- `orders.totalAmount` com `transition.legacy.totalAmount`.

## 7. Teste funcional controlado

Somente depois de `orders-health` retornar `ok: true`:

1. faça um pedido de teste pequeno;
2. confirme que ele aparece no Admin;
3. altere o status para `preparing`;
4. abra `/pedido/REFERENCIA_DO_PEDIDO`;
5. confirme o mesmo status;
6. volte ao `/api/admin/orders-health`.

O resultado deve continuar com:

```json
"countsMatch": true
```

## NÃO fazer

- não apagar `data/store.json`;
- não usar `--force`;
- não editar tabelas manualmente no Railway;
- não executar a importação antes da migration 004;
- não avançar se `orders-health` mostrar divergência.

## Próxima fase

A próxima fase migrará clientes/contas e começará a retirar dependências do
arquivo legado. Só depois de todos os módulos críticos migrarem o `store.json`
será removido.
