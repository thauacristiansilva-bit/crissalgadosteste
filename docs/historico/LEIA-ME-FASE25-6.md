# SaborFlow — FASE 25.6

## Financeiro/Caixa PostgreSQL + convite endurecido

Esta fase reúne as correções pendentes após a Fase 25.4/25.5:

1. corrige o erro ao cadastrar **despesas/outras receitas**;
2. remove definitivamente o fallback de `/api/financial` para `store.json`;
3. remove o mesmo fallback residual de `/api/cash` antes que abertura/fechamento de caixa sofra o mesmo erro;
4. mantém financeiro e caixa estritamente PostgreSQL tenant-aware, sob RLS e RBAC;
5. valida tipo, descrição, categoria e valor no backend financeiro;
6. valida ação e valores do caixa no backend;
7. separa as mensagens de erro/sucesso de **Caixa** e **Lançamento financeiro** na interface;
8. endurece a leitura e o aceite dos convites para não depender de uma sessão administrativa no navegador do colaborador;
9. diferencia convite realmente inválido/expirado de indisponibilidade temporária de validação;
10. adiciona health check específico da fase.

Não há migration nova nesta fase.

---

## Causa do erro financeiro corrigida

Depois do desligamento do legado na Fase 25, `lib/db.ts` passou a rejeitar gravações em `store.json`. Porém `/api/financial` ainda conservava um fallback antigo: se a sessão tenant ou o estado operacional não fossem reconhecidos, a rota tentava chamar `createFinancialEntry()` do legado.

Por isso a interface mostrava a mensagem:

```text
Legado store.json desligado na Fase 25. A lançamento financeiro deve usar PostgreSQL tenant-aware.
```

A Fase 25.6 remove esse caminho. Se a sessão tenant estiver inválida, a API responde 401. Se o PostgreSQL operacional não estiver pronto, responde 503. **Em nenhum dos casos volta para `store.json`.**

O mesmo endurecimento foi aplicado ao caixa, que ainda tinha o mesmo fallback residual.

---

## 1. Aplicação

Extraia o ZIP na raiz do projeto atual, que já deve conter a Fase 25.4/25.5.

No PowerShell:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se aparecer `Type error`, `Build error occurred` ou `Failed to type check`, pare e envie o primeiro erro completo.

---

## 2. Arquivos funcionais

```text
app/api/admin/phase25-6-health/route.ts
app/api/cash/route.ts
app/api/financial/route.ts
app/api/invitations/[token]/route.ts
components/admin/sales-panel.tsx
lib/team-access-db.ts
```

O arquivo de instruções é:

```text
LEIA-ME-FASE25-6.md
```

Faça stage somente dos arquivos funcionais:

```powershell
git add -- `
"app/api/admin/phase25-6-health/route.ts" `
"app/api/cash/route.ts" `
"app/api/financial/route.ts" `
"app/api/invitations/[token]/route.ts" `
"components/admin/sales-panel.tsx" `
"lib/team-access-db.ts"

git diff --cached --check
git --no-pager diff --cached --name-only
```

Commit:

```powershell
git commit -m "Corrigir financeiro caixa e convites da fase 25.6"
git push origin main
```

**Não rode migration para a Fase 25.6.** A migration mais recente continua sendo a 027 da Fase 25.4/25.5.

---

## 3. Teste de despesa

Depois do Railway ficar `SUCCESS`:

```text
Admin
→ Vendas / Financeiro
→ Lançamento financeiro
→ Despesa
→ categoria: Geral ou outra categoria
→ descrição: Teste despesa Fase 25.6
→ valor: 200,00
→ Salvar
```

Esperado:

```text
Despesa salva no PostgreSQL.
```

A despesa deve entrar imediatamente no cartão **Despesas** e no cálculo do saldo operacional.

Depois recarregue a página. O lançamento deve continuar presente, comprovando persistência no PostgreSQL.

Teste também um valor inválido (`0`, vazio ou texto). O backend deve rejeitar sem criar lançamento.

---

## 4. Teste do caixa

Com o caixa fechado:

```text
valor inicial: 0
→ Abrir caixa
```

Esperado:

```text
Caixa aberto.
```

Depois informe um valor de fechamento e feche o caixa.

As mensagens do caixa agora aparecem somente no cartão de **Caixa**. Erros do lançamento financeiro aparecem somente dentro de **Lançamento financeiro**.

---

## 5. Teste do convite

Em:

```text
Admin
→ Equipe e acessos
→ colaborador
→ Novo convite
```

Copie o link recém-gerado e abra em janela anônima.

Esperado:

```text
Convite para equipe
+ nome
+ e-mail
+ empresa
+ perfil
```

Se o usuário ainda não possui senha, deve criar uma senha de pelo menos 8 caracteres e aceitar o convite. Depois deve entrar em `/login` normalmente.

Importante: gerar **Novo convite** revoga os tokens anteriores daquele usuário/empresa. Portanto teste sempre o link mais recente.

---

## 6. Health da Fase 25.6

Abra autenticado no Admin:

```text
https://crissalgadosteste-production.up.railway.app/api/admin/phase25-6-health
```

Esperado:

```json
{
  "ok": true,
  "phase": "25.6-finance-cash-invitation-hardening",
  "authority": {
    "database": "postgresql",
    "operationsReady": true,
    "legacyStoreRuntimeEnabled": false,
    "financialLegacyFallback": false,
    "cashLegacyFallback": false
  },
  "rls": {
    "roleAvailable": true,
    "failClosedWhenUnscoped": true
  }
}
```

As contagens de `cashSessions`, `financialEntries` e `pendingInvites` variam conforme os dados da empresa.

---

## 7. Regressão obrigatória

Depois valide também:

```text
/api/admin/rbac-health
/api/admin/rls-health
/api/admin/legacy-health
/api/admin/billing-health
/api/admin/delivery-dispatch-health
/api/admin/delivery-tracking-health
/api/admin/workspaces-health
```

A Fase 25.6 não altera o rastreamento do entregador, a privacidade da entrega ativa, billing, catálogo, pedidos ou schema RLS.
