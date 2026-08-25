# SaborFlow — FASE 21 — Fidelidade, CRM e marketing

Esta fase cria uma camada de relacionamento por organização, sem misturar dados entre tenants.

## Entregas

- `/admin/crm`
- `/api/admin/crm`
- `/api/admin/crm/actions`
- `/api/admin/crm-health`
- perfis CRM com tags, notas e consentimento de marketing
- segmentação por comportamento já derivada dos pedidos
- extrato auditável de fidelidade
- crédito de pontos somente ao concluir pedido
- estorno dos pontos disponíveis quando pedido concluído é cancelado
- resgate e ajustes manuais auditáveis
- planejamento de campanhas por segmento
- nenhum disparo externo em massa nesta fase; integrações ficam para a FASE 23

## Migration

`database/migrations/020_crm_loyalty_marketing.sql`

Cria:

- `sf_crm_customer_profiles`
- `sf_loyalty_ledger`
- `sf_crm_campaigns`

A migration registra o saldo de fidelidade já existente como saldo de abertura. Pedidos criados antes da migration não recebem um segundo crédito ao serem concluídos depois do corte.

RLS continua preparado sem enforcement até a FASE 24.

## Instalação

Depois de extrair na raiz:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
git status --short
```

Não use `git add .`.

Depois do deploy verde, execute no Railway:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado:

```text
APLICANDO 020_crm_loyalty_marketing...
OK 020_crm_loyalty_marketing
```

## Validação

- `/admin/crm`
- `/api/admin/crm-health`
- `/api/admin/billing-health`
