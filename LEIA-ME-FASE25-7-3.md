# SaborFlow — Correção Fase 25.7.3

## Problema corrigido

Ao criar uma área personalizada de entrega, a API ainda possuía um fallback antigo para `lib/db.ts`. Como o runtime `store.json` foi desligado definitivamente na Fase 25, esse fallback terminava com:

`Legado store.json desligado na Fase 25. A criação de área de entrega deve usar PostgreSQL tenant-aware.`

A mesma dependência residual existia nos caminhos de listar, atualizar e excluir áreas e no cálculo de entrega do PDV quando a sessão tenant não era resolvida corretamente.

Nesta correção, esses fluxos passam a ser PostgreSQL-only e fail-closed: se a sessão multiempresa ou o schema operacional não estiverem disponíveis, a API retorna erro explícito e nunca tenta `store.json`.

## O que foi corrigido

- criação de área de entrega somente em `sf_delivery_zones`;
- listagem de áreas somente no PostgreSQL tenant-aware;
- atualização e ativação/desativação somente no PostgreSQL;
- exclusão somente no PostgreSQL;
- cálculo de taxa/área no PDV somente com configurações e áreas da empresa atual;
- RLS explícito com `runWithTenantRlsScope` em todos esses caminhos;
- entitlement de Delivery preservado no CRUD;
- validação de nome, coordenadas, taxa e polígono;
- exclusão agora mostra o erro retornado pela API na própria tela;
- health específico para comprovar que não existe fallback legado.

## Arquivos funcionais

- `app/api/delivery-zones/route.ts`
- `app/api/delivery-zones/[id]/route.ts`
- `app/api/admin/pdv-delivery-quote/route.ts`
- `app/api/admin/delivery-zones-health/route.ts`
- `components/admin/delivery-settings.tsx`

## Migration

Não existe migration nova nesta correção. A tabela `sf_delivery_zones` já pertence ao schema operacional PostgreSQL existente.

## Aplicação — terminal PowerShell do VS Code

Extraia o ZIP na raiz do projeto, substituindo os arquivos quando solicitado.

Depois rode:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se o build passar:

```powershell
git status --short
```

Faça stage somente destes arquivos:

```powershell
git add -- `
"app/api/delivery-zones/route.ts" `
"app/api/delivery-zones/[id]/route.ts" `
"app/api/admin/pdv-delivery-quote/route.ts" `
"app/api/admin/delivery-zones-health/route.ts" `
"components/admin/delivery-settings.tsx"
```

Confira:

```powershell
git diff --cached --check
git --no-pager diff --cached --name-only
```

Commit e push:

```powershell
git commit -m "Corrigir areas de entrega no PostgreSQL"
git push origin main
```

Não rode migration para a Fase 25.7.3.

## Teste depois do Railway SUCCESS

### 1. Health

Autenticado como administrador, abra:

`https://crissalgadosteste-production.up.railway.app/api/admin/delivery-zones-health`

Esperado:

```json
{
  "ok": true,
  "phase": "25.7.3-delivery-zones-postgresql-only",
  "database": "postgresql",
  "schemaReady": true,
  "tenantRuntimeReady": true,
  "capabilities": {
    "createDeliveryZonePostgresql": true,
    "updateDeliveryZonePostgresql": true,
    "deleteDeliveryZonePostgresql": true,
    "listDeliveryZonesPostgresql": true,
    "pdvDeliveryQuotePostgresql": true,
    "explicitTenantRlsScope": true
  },
  "legacy": {
    "deliveryZoneFallback": false,
    "pdvDeliveryQuoteFallback": false,
    "storeJsonWrites": false
  }
}
```

### 2. Criar área personalizada

No Admin:

`Configurações → Entrega → Áreas personalizadas`

Desenhe pelo menos 3 pontos, informe nome e taxa e salve.

A área deve ser criada sem mensagem de `store.json`. Atualize a página e confirme que ela continua aparecendo.

### 3. CRUD completo

Depois teste:

1. editar nome/taxa da área;
2. desativar e ativar a área;
3. excluir uma área de teste;
4. atualizar a página em cada etapa para confirmar persistência no PostgreSQL.

### 4. PDV

No PDV, informe um endereço dentro da área criada. O cálculo de entrega deve usar as áreas da empresa atual e não pode chamar o legado.

## Regressões que não devem mudar

A correção não altera entregador, rota, GPS, rastreamento do cliente, convite, financeiro, caixa, billing ou a regra de privacidade da entrega ativa.
