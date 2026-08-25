# SaborFlow — Fase 7: Operação Multiempresa

Esta fase migra os módulos operacionais restantes de maior uso para PostgreSQL,
sempre isolados por `organization_id`.

## Novas tabelas

- `sf_coupons`
- `sf_feedbacks`
- `sf_cash_sessions`
- `sf_financial_entries`
- `sf_delivery_zones`
- `sf_couriers`
- `sf_operations_state`

## O que passa a usar PostgreSQL

No Admin, quando a Fase 7 está marcada como pronta:

- cupons;
- avaliações;
- caixa;
- lançamentos financeiros;
- áreas de entrega;
- entregadores.

O Dashboard também recebe esses arrays do PostgreSQL através do carregamento
tenant-aware.

## Segurança

As consultas administrativas usam o `organizationId` da sessão assinada.

O cliente não escolhe o `organization_id`.

Ao atribuir um entregador a um pedido, a API agora busca o entregador dentro da
mesma organização e usa o nome retornado pelo banco. Assim, `courierName`
enviado pelo navegador não é confiado em modo multiempresa.

Papéis:

- marketing/cupons: owner, admin, manager;
- avaliações: owner, admin, manager;
- caixa: owner, admin, manager, cashier;
- financeiro: owner, admin, manager;
- áreas/entregadores: owner, admin, manager.

## Transição

O `store.json` ainda NÃO é removido.

Para a empresa atual do deployment, cada alteração feita no PostgreSQL continua
espelhada em `/data/store.json`, pois configurações e alguns fluxos do checkout
ainda dependem do legado.

Também foi alterado o cálculo público de entrega para usar as áreas PostgreSQL
primeiro, com fallback legado durante o rollout.

A validação pública de cupom usa PostgreSQL primeiro.

A criação de feedback público grava no PostgreSQL quando a Fase 7 está pronta.

---

## 1. Copiar o pacote

Extraia o ZIP e copie todo o conteúdo para a raiz do projeto.

## 2. Build local

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se falhar, NÃO faça commit.

## 3. Git

```powershell
git add database/migrations/006_operations_multiempresa.sql
git add scripts/import-operations-multiempresa.mjs
git add lib/operations-db.ts
git add lib/tenant-permissions.ts
git add lib/db.ts
git add lib/tenant-admin-data.ts
git add app/api/coupons/route.ts
git add app/api/coupons/[id]/route.ts
git add app/api/feedback/route.ts
git add app/api/cash/route.ts
git add app/api/financial/route.ts
git add app/api/delivery-zones/route.ts
git add app/api/delivery-zones/[id]/route.ts
git add app/api/couriers/route.ts
git add app/api/couriers/[id]/route.ts
git add app/api/delivery/quote/route.ts
git add app/api/orders/[id]/route.ts
git add app/api/admin/operations-health/route.ts

git status
git commit -m "Migrar operacao para PostgreSQL multiempresa SaborFlow"
git push origin main
```

Se `next-env.d.ts` aparecer modificado fora do commit:

```powershell
git restore next-env.d.ts
```

Não use `git add .`.

Espere o Railway ficar `SUCCESS`.

## 4. Aplicar migration 006

No Console do serviço `crissalgadosteste`:

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
APLICANDO 006_operations_multiempresa...
OK 006_operations_multiempresa
```

## 5. Importar operação atual

```bash
node scripts/import-operations-multiempresa.mjs
```

A origem esperada agora é:

```text
/data/store.json
```

Se aparecer:

```text
/app/data/store.seed.json
```

PARE. A Fase 6.1 deveria ter criado o Volume persistente da aplicação.

Não use `--force`.

Resultado esperado:

```text
SaborFlow - operação multiempresa importada com sucesso.
Empresa: Cris Salgados
Cupons: ...
Avaliações: ...
Sessões de caixa: ...
Lançamentos financeiros: ...
Áreas de entrega: ...
Entregadores: ...
Origem: /data/store.json
store.json não foi apagado nem alterado.
```

## 6. Health check

Logado no Admin:

`https://crissalgadosteste-production.up.railway.app/api/admin/operations-health`

Esperado:

```json
{
  "ok": true,
  "operations": {
    "ready": true
  },
  "transition": {
    "legacyMirrorEnabled": true,
    "countsMatch": true
  }
}
```

## 7. Testes controlados

Somente depois de `ok: true`:

1. crie um cupom de teste e valide no checkout;
2. abra e feche um caixa de teste;
3. crie um lançamento financeiro pequeno;
4. se já houver área de entrega, altere apenas algo reversível, como taxa, e
   confirme a cotação no checkout;
5. se houver entregador, atribua-o a um pedido e confira o pedido;
6. se o pedido de teste puder ser avaliado, envie uma avaliação;
7. abra novamente `/api/admin/operations-health`.

O resultado deve continuar:

```json
"ok": true,
"countsMatch": true
```

## NÃO fazer

- não apagar `/data/store.json`;
- não remover o Volume da aplicação;
- não usar `--force`;
- não editar as tabelas manualmente no Railway;
- não avançar se a origem voltar a ser `store.seed.json`;
- não avançar se `countsMatch` for `false`.

## Depois da Fase 7

Os grandes módulos operacionais já estarão em PostgreSQL.

Ainda restarão principalmente:

- configurações completas da empresa;
- equipe/colaboradores;
- alguns dados auxiliares do legado;
- resolução pública de empresa por slug/domínio;
- onboarding definitivo CPF/CNPJ;
- Google OAuth;
- seletor de empresa para usuário com múltiplas organizações.

Esses pontos devem ser resolvidos antes da remoção definitiva do `store.json`.
