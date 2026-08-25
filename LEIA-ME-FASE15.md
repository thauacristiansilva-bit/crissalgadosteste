# SaborFlow — FASE 15 — Onboarding comercial definitivo

## Objetivo

Substituir o fluxo genérico de criação de empresa pelo onboarding comercial guiado:

```text
Contratante
→ assinatura ativa
→ criar primeira loja
→ dados comerciais
→ identidade visual
→ horários
→ delivery/retirada
→ produtos
→ publicar
```

A loja criada na Fase 15 começa privada:

```text
onboarding_status = pending
public_store_enabled = false
public_ordering_enabled = false
```

Somente o backend publica a loja depois de validar assinatura, etapas, canal de atendimento e pelo menos um produto ativo.

## Migration

```text
database/migrations/014_commercial_onboarding.sql
```

Cria:

```text
sf_organization_onboarding
```

Organizações já existentes são preservadas como concluídas, sem serem obrigadas a refazer o onboarding.

RLS da nova tabela fica somente preparado, com enforcement desligado até a Fase 24.

## Arquivos funcionais da Fase 15

```text
app/admin/nova-empresa/page.tsx
app/admin/page.tsx
app/api/admin/commercial-onboarding/route.ts
app/api/admin/onboarding-health/route.ts
app/api/admin/organizations/route.ts
app/onboarding/page.tsx
components/admin/organization-onboarding-form.tsx
components/onboarding/commercial-onboarding.tsx
database/migrations/014_commercial_onboarding.sql
lib/commercial-onboarding.ts
lib/organization-onboarding.ts
```

## Instalação

Extraia o ZIP na raiz do projeto, substituindo os arquivos.

Depois:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se houver erro de Build/Type, não faça commit.

Se o build passar:

```powershell
git status --short
```

Envie a saída para conferência antes do stage.

## Depois do deploy

Após commit/push e Railway `SUCCESS`, execute:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado:

```text
SKIP 013_billing_checkout_webhooks - já aplicada
APLICANDO 014_commercial_onboarding...
OK 014_commercial_onboarding
```

## Health checks

Onboarding:

```text
https://crissalgadosteste-production.up.railway.app/api/admin/onboarding-health
```

Billing:

```text
https://crissalgadosteste-production.up.railway.app/api/admin/billing-health
```

Ambos devem ser abertos já logado no Admin.
