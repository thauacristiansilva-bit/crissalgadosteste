# SaborFlow — Correção Fase 15.1

## Motivo

A migration 014 considerava como legado concluído apenas organizações cujo `onboarding_status` já era `complete`.
Algumas lojas operacionais anteriores à Fase 15 ainda possuíam `onboarding_status = pending`, mesmo com loja pública e catálogo em uso. Isso faria a loja antiga ser redirecionada para o novo onboarding comercial.

## Correção

A migration `015_reconcile_legacy_commercial_onboarding.sql` usa o `applied_at` registrado para a migration 014 como corte temporal.
Toda organização criada antes desse corte é tratada como organização legada e recebe:

- `onboarding_status = complete`;
- `onboarding_version >= 3`;
- estado v3 em `published`;
- todas as etapas do onboarding comercial marcadas como concluídas.

Organizações criadas depois da Fase 15 não são alteradas e continuam obrigadas a concluir o onboarding comercial.

A migration não altera assinatura, billing, produtos, pedidos, configurações de entrega ou os flags públicos atuais da loja.

## Instalação

Extraia o ZIP na raiz do projeto.

Stage somente:

```powershell
git add database/migrations/015_reconcile_legacy_commercial_onboarding.sql
git diff --cached --check
git --no-pager diff --cached --name-only
```

Depois de confirmar o stage:

```powershell
git commit -m "Corrigir onboarding de lojas legadas"
git push origin main
```

Após Railway `SUCCESS`:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado:

```text
SKIP 014_commercial_onboarding - já aplicada
APLICANDO 015_reconcile_legacy_commercial_onboarding...
OK 015_reconcile_legacy_commercial_onboarding
```

Depois valide `/api/admin/onboarding-health`.
