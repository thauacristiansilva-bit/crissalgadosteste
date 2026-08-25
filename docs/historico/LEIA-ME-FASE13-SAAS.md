# SaborFlow — FASE 13 comercial — Planos e estrutura SaaS

Esta é a Fase 13 do **roadmap comercial SaaS**. A DRE gerencial e a ajuda contextual já instaladas permanecem no produto; esta fase adiciona a camada comercial necessária para vender o SaborFlow com limites e recursos por plano.

## O que entra

### Banco

Migration:

`database/migrations/012_saas_billing_plans.sql`

Cria:

- `sf_billing_accounts`
- `sf_plans`
- `sf_plan_entitlements`
- `sf_subscriptions`
- `sf_subscription_events`
- `sf_usage_counters`

Também adiciona `billing_account_id` a `sf_organizations`.

### Entitlements suportados

- `maxOrganizations`
- `maxUsers`
- `maxProducts`
- `customDomain`
- `delivery`
- `kitchen`
- `financial`
- `loyalty`
- `modifiers`
- `inventory`
- `advancedReports`

Semântica nesta fase:

- `maxOrganizations`: total de lojas da conta contratante;
- `maxUsers`: usuários com membership `active` ou `invited`, considerando todas as lojas da conta;
- `maxProducts`: produtos da loja atual;
- recursos booleanos: herdados da assinatura/plano da conta contratante.

### Compatibilidade com a produção atual

A migration cria um plano interno `legacy-existing` para preservar contas que já existiam antes do billing.

Ele:

- mantém os recursos atuais habilitados;
- cria uma assinatura interna `active`;
- vincula as organizações existentes à conta contratante;
- define `maxOrganizations` por override exatamente no número de lojas já utilizadas.

Portanto, a operação existente continua funcionando, mas uma conta que usa `1/1` loja não consegue cadastrar uma segunda loja sem um plano que aumente o limite.

O plano `legacy-existing` é interno e não deve aparecer no futuro site de contratação.

## Autoridade

O navegador nunca decide se um recurso está liberado.

A autoridade fica em:

`lib/billing-db.ts`

A criação de nova loja chama `reserveOrganizationSlot(...)` dentro da mesma transação de onboarding.

O servidor exige:

1. conta comercial ativa;
2. assinatura `active`;
3. `organizationsUsed < maxOrganizations`.

Nesta Fase 13, `trialing` ainda não libera recursos. Isso será alterado conscientemente na Fase 16 quando o trial for implementado.

## Gates aplicados

Além do bloqueio obrigatório de nova loja, esta fase já conecta os entitlements principais a rotas reais:

- `maxProducts` → cadastro de produto;
- `maxUsers` → criação de novo acesso de equipe;
- `customDomain` → cadastro de domínio;
- `delivery` → cotação, áreas, checkout público e PDV de entrega;
- `financial` → caixa e lançamentos financeiros;
- `loyalty` → ativação da fidelidade nas configurações;
- `modifiers` → uso/salvamento de complementos;
- `inventory` → ingredientes, movimentos e composição que consome ingredientes;
- `advancedReports` → DRE gerencial.

O recurso `kitchen` já existe no catálogo de entitlements e será usado para apresentação/roteamento comercial do KDS à medida que a camada comercial avançar. O plano de compatibilidade atual o mantém habilitado.

## Painel

Owners recebem uma nova seção:

`Plano e assinatura`

Ela mostra:

- plano atual;
- status da assinatura;
- uso de lojas;
- uso de usuários;
- uso de produtos da loja atual;
- recursos incluídos.

A criação de nova loja passa a mostrar o uso `X / limite` antes do envio.

Somente o `owner` da conta contratante pode adicionar loja. Admin operacional não cria nova organização em nome da conta.

## Fase 14

Nenhum gateway foi acoplado nesta fase.

A Fase 14 implementará:

`Escolher plano → conta → checkout → pagamento → webhook → assinatura ativa → onboarding`

Os planos comerciais e preços públicos serão definidos nessa fase, sem inventar preço dentro da migration estrutural.

---

# Instalação

## 1. Extraia o ZIP na raiz do projeto

Substitua os arquivos indicados.

## 2. Build local

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se houver `Build error occurred`, `Type error` ou `Failed to type check`, não faça commit.

Os warnings já conhecidos do Turbopack sobre filesystem continuam não bloqueantes quando o build termina com sucesso.

## 3. Git

Não use `git add .`.

Depois do build, rode:

```powershell
git status --short
```

Adicione somente os arquivos desta fase após conferir a lista.

## 4. Deploy

Faça commit/push e aguarde o Railway ficar `SUCCESS`.

## 5. Migration

No Console do serviço da aplicação:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado no final:

```text
SKIP 011_backfill_rls_after_out_of_order_010 - já aplicada
APLICANDO 012_saas_billing_plans...
OK 012_saas_billing_plans
```

## 6. Health check

Logado no Admin, abra:

`/api/admin/billing-health`

Para a conta existente, o esperado é equivalente a:

```json
{
  "ok": true,
  "phase": "13-saas",
  "ready": true,
  "organizationLinked": true,
  "subscription": {
    "status": "active",
    "planCode": "legacy-existing",
    "internal": true
  },
  "usage": {
    "organizations": 1
  },
  "limits": {
    "maxOrganizations": 1
  },
  "authority": "backend-only"
}
```

Os números de usuários e produtos dependem dos dados reais da conta.

## 7. Teste de limite de loja

Em `Plano e assinatura`, confirme algo como:

`Lojas 1 / 1`

Ao abrir a tela de adicionar loja, ela deve mostrar que o limite foi atingido e impedir a criação.

Não altere manualmente a assinatura para testar. Na Fase 14, mudanças de assinatura passarão por backend/webhook do provedor.
