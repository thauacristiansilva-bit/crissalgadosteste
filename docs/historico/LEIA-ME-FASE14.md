# SaborFlow — FASE 14 — Contratação, cobrança e liberação após pagamento — v18.14

Pacote preparado sobre a **FASE 13 comercial SaaS v18.13**.

## Objetivo

Transformar a estrutura de planos da Fase 13 em um fluxo de contratação real:

```text
Escolher plano
  → criar/entrar na conta contratante
  → iniciar checkout
  → pagamento no provedor
  → webhook + reconciliação servidor-servidor
  → assinatura ativa
  → liberar primeira loja / manter upgrade
```

A autoridade da assinatura é sempre o backend. O navegador **não recebe rota para marcar assinatura como ativa**.

## Arquitetura de provedor

O núcleo de cobrança usa um adaptador em `lib/billing-provider.ts`.

A primeira implementação incluída é:

```text
mercado_pago
```

O restante do sistema conhece apenas a interface do provedor. Outro gateway poderá ser implementado depois sem reescrever planos, assinaturas, checkout, onboarding ou limites.

## Migration 013

Arquivo:

```text
database/migrations/013_billing_checkout_webhooks.sql
```

Ela acrescenta:

- configuração de checkout nos planos;
- estado de onboarding na conta contratante;
- vínculo de assinatura com checkout;
- estado retornado pelo provedor;
- `sf_checkout_sessions`;
- `sf_billing_webhook_events`;
- índices de idempotência para notificações.

Não remove nem altera os dados operacionais de lojas existentes.

## Fluxo de segurança

### Checkout

O frontend envia apenas:

```text
planCode
billingCycle
```

O backend busca o plano publicado no PostgreSQL e obtém de lá:

- preço real;
- moeda;
- plano;
- conta contratante;
- assinatura local.

O browser não define preço, status de assinatura ou quantidade de lojas liberadas.

### Confirmação do pagamento

O retorno visual do checkout não libera nada sozinho.

O backend:

1. recebe webhook assinado; ou
2. consulta diretamente a assinatura no provedor durante a reconciliação;
3. converte o status do provedor para o status interno;
4. somente então ativa a assinatura;
5. só depois libera o onboarding/upgrade.

### Idempotência

`sf_billing_webhook_events` impede processamento duplicado do mesmo evento. Eventos que falharam podem ser tentados novamente; eventos já processados/ignorados não são reaplicados.

Webhooks atrasados de um checkout já substituído não podem reativar um plano antigo.

## Compatibilidade com clientes existentes

A assinatura interna `legacy-existing` criada na Fase 13 continua válida enquanto uma contratação nova estiver apenas `pending`.

No upgrade:

```text
plano atual ativo
  + novo checkout pendente
  = plano atual continua funcionando
```

Somente quando o provedor confirmar a nova assinatura como ativa:

- a nova assinatura passa a ser a atual;
- a anterior é marcada como substituída/cancelada localmente;
- o override de `maxOrganizations` do bootstrap da Fase 13 é removido;
- os limites passam a vir do plano comercial contratado.

## Rotas adicionadas

Públicas/comerciais:

```text
/contratar
/contratar/retorno
/api/billing/plans
/api/billing/signup
/api/billing/sign-in
/api/billing/status
/api/billing/checkout
/api/billing/webhooks/mercado-pago
```

Atualizadas:

```text
/admin/nova-empresa
/api/admin/organizations
/api/admin/billing-health
Plano e assinatura (Admin)
```

## Variáveis de ambiente

Depois do deploy e da migration, configure no serviço da aplicação do Railway:

```text
BILLING_PROVIDER=mercado_pago
MERCADO_PAGO_ACCESS_TOKEN=<segredo do provedor>
MERCADO_PAGO_WEBHOOK_SECRET=<segredo de assinatura do webhook>
APP_BASE_URL=https://SEU-DOMINIO-PUBLICO
```

Opcional:

```text
BILLING_WEBHOOK_MAX_AGE_SECONDS=900
```

`SESSION_SECRET` e `DATABASE_URL` continuam obrigatórios como nas fases anteriores.

**Nunca coloque access token, webhook secret, SESSION_SECRET ou DATABASE_URL no Git, README, print ou chat.**

## Webhook do provedor

Depois que as variáveis existirem, configure no provedor a URL pública:

```text
https://SEU-DOMINIO-PUBLICO/api/billing/webhooks/mercado-pago
```

Habilite as notificações de assinatura/preapproval usadas pelo checkout de recorrência.

O endpoint rejeita notificações cuja assinatura HMAC não valide.

## Planos e preços

A migration **não inventa planos ou preços comerciais**.

O plano interno `legacy-existing` permanece oculto do checkout.

Para publicar um plano comercial, use:

```text
scripts/upsert-saas-plan.mjs
```

No Railway Console, defina temporariamente as variáveis do comando/processo:

```text
PLAN_CODE=<codigo>
PLAN_NAME=<nome>
PLAN_DESCRIPTION=<descricao>
PLAN_MONTHLY_CENTS=<preco_mensal_em_centavos>
PLAN_ANNUAL_CENTS=<preco_anual_em_centavos, opcional>
PLAN_SORT_ORDER=<ordem>
PLAN_ENTITLEMENTS_JSON=<json dos limites e recursos>
```

Exemplo de formato de `PLAN_ENTITLEMENTS_JSON` (substitua pelos limites comerciais reais):

```json
{
  "maxOrganizations": 1,
  "maxUsers": 3,
  "maxProducts": 100,
  "customDomain": false,
  "delivery": true,
  "kitchen": true,
  "financial": true,
  "loyalty": false,
  "modifiers": true,
  "inventory": true,
  "advancedReports": false
}
```

Depois execute:

```bash
node scripts/upsert-saas-plan.mjs
```

O JSON acima é apenas exemplo de **formato**, não uma recomendação de plano/preço.

## Instalação do pacote

Extraia este ZIP na raiz do projeto, substituindo os arquivos indicados.

Antes de commit:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se houver `Build error occurred`, `Type error` ou `Failed to type check`, não faça commit.

Depois:

```powershell
git status --short
```

Confira os arquivos da Fase 14 antes de adicionar ao Git. Não use `git add .`.

## Deploy e migration

Depois de build, commit e push, aguarde o Railway ficar `SUCCESS`.

No Console da aplicação:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado no final:

```text
SKIP 012_saas_billing_plans - já aplicada
APLICANDO 013_billing_checkout_webhooks...
OK 013_billing_checkout_webhooks
```

## Health check

Logado como owner/admin:

```text
/api/admin/billing-health
```

A resposta da Fase 14 informa, entre outros:

```text
phase: 14-billing
ready
organizationLinked
subscription
checkout.publicPlans
checkout.provider
checkout.providerConfigured
checkout.webhookConfigured
checkout.appBaseUrlConfigured
checkout.saleReady
checkout.authority = provider-confirmed-backend-only
```

Antes de cadastrar planos e segredos, `saleReady` pode ser `false` sem significar falha da migration.

Para abrir vendas, o esperado é:

```text
publicPlans > 0
providerConfigured = true
webhookConfigured = true
appBaseUrlConfigured = true
saleReady = true
```

## Teste funcional recomendado

### A. Conta nova

1. Abra `/contratar` em janela anônima.
2. Crie uma conta nova.
3. Escolha um plano publicado.
4. Inicie o checkout.
5. Conclua o pagamento no ambiente apropriado do provedor.
6. Retorne a `/contratar/retorno`.
7. Confirme que a tela só mostra pagamento confirmado após a reconciliação do backend.
8. Entre em `Configurar minha primeira loja`.

### B. Upgrade de cliente existente

1. Entre no Admin da conta existente.
2. Abra `Plano e assinatura`.
3. Inicie um novo plano.
4. Antes da confirmação, confira que o plano atual continua operando.
5. Depois da confirmação, confira que o novo plano aparece como ativo e os novos limites passam a valer.

### C. Idempotência

O mesmo webhook pode ser reenviado pelo provedor sem duplicar a ativação ou os eventos de assinatura.

## Importante para a Fase 15

Nesta fase, após o primeiro pagamento, usamos temporariamente a tela existente `/admin/nova-empresa` para criar a primeira loja.

Na **FASE 15**, ela será substituída pelo onboarding comercial definitivo:

```text
contratante
→ pagamento confirmado
→ primeira loja
→ dados comerciais
→ identidade visual
→ horários
→ delivery/retirada
→ produtos
→ publicar
```
