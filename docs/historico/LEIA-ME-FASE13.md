# SaborFlow — Fase 13 — Financeiro + DRE gerencial — v17.13

Pacote preparado sobre a Fase 12.5.

## Objetivo

Adicionar uma DRE gerencial multiempresa ao Admin sem duplicar vendas e sem criar uma contabilidade paralela.

A DRE usa dados que o SaborFlow já grava no PostgreSQL:

- `sf_orders` para receita de vendas, entrega, descontos, pagamentos e cancelamentos;
- `sf_financial_entries` para outras receitas e despesas manuais;
- `sf_inventory_movements` para CMV real por baixa de ingredientes e perdas de estoque;
- `sf_food_composition_state` para indicar se a ficha técnica está pronta.

## O que entra nesta fase

### DRE gerencial

Nova opção **DRE gerencial** no menu do Admin para `owner`, `admin` e `manager`.

Filtros:

- Hoje;
- últimos 7 dias;
- este mês;
- mês anterior;
- período personalizado.

Indicadores:

- receita líquida;
- CMV;
- lucro bruto;
- resultado líquido;
- margem bruta;
- margem líquida;
- CMV sobre receita;
- ticket médio;
- recebido;
- a receber;
- pedidos e cancelamentos.

Demonstrativo:

1. vendas de produtos;
2. receita de entrega;
3. receita bruta;
4. descontos e cupons;
5. receita líquida de vendas;
6. outras receitas;
7. receita líquida total;
8. CMV;
9. lucro bruto;
10. despesas operacionais agrupadas;
11. resultado líquido gerencial.

### Despesas agrupadas

Os lançamentos manuais são classificados em grupos gerenciais:

- Pessoal e encargos;
- Aluguel e ocupação;
- Água, energia e utilidades;
- Marketing e publicidade;
- Logística e entregas;
- Despesas financeiras;
- Impostos e taxas;
- Administrativas;
- Manutenção e reparos;
- Perdas de estoque;
- Outras despesas.

O formulário **Vendas e caixa → Lançamento financeiro** agora sugere essas categorias.

### CMV automático

O CMV não usa o preço informado no navegador.

Ele é calculado com as baixas reais `sale` de `sf_inventory_movements`, usando `quantity_delta × unit_cost_snapshot`, vinculadas aos pedidos não cancelados do período.

Pedidos cancelados não entram na receita nem no CMV.

Movimentos `waste` entram como **Perdas de estoque**.

A DRE mostra a cobertura do CMV. Se existirem pedidos sem ficha técnica/baixa de ingredientes, ela avisa que o CMV está parcial.

### Comparação

O período selecionado é comparado automaticamente com o período imediatamente anterior de mesma duração.

### Exportação

A DRE pode ser exportada em CSV para Excel.

## Regime utilizado

A Fase 13 usa **competência gerencial**:

- pedido não cancelado entra pela data de criação;
- pagamento pendente continua compondo a receita da DRE;
- `Vendas e caixa` continua sendo a visão operacional/financeira de recebimentos e caixa.

Esta DRE é gerencial e não substitui escrituração contábil/fiscal.

## Importante — não duplicar receita

As vendas dos pedidos já entram automaticamente.

**Não registre a mesma venda novamente em Lançamento financeiro.**

Use `income` somente para outras receitas que não sejam pedidos do SaborFlow.

## Banco de dados

**Não existe migration nova na Fase 13.**

A fase reutiliza as tabelas já instaladas nas Fases 4, 6 e 11/12.

Não execute migration por causa desta fase.

## Arquivos da Fase 13

```text
app/api/admin/dre/route.ts
app/api/admin/dre-health/route.ts
components/admin/admin-dashboard.tsx
components/admin/dre-panel.tsx
components/admin/sales-panel.tsx
lib/admin-access.ts
lib/dre-db.ts
lib/dre-types.ts
```

## Instalação

### 1. Pré-requisito

A Fase 12.5 deve estar instalada. Preferencialmente faça commit/push da Fase 12.5 antes de começar esta fase para manter o histórico Git separado.

### 2. Extrair

Extraia o ZIP na raiz do projeto e substitua os arquivos indicados.

### 3. Build

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Os warnings conhecidos do Turbopack sobre `media/[name]` e `lib/db.ts` continuam não bloqueantes quando o build termina com sucesso.

### 4. Git

Não use `git add .`.

```powershell
git restore next-env.d.ts

git add app/api/admin/dre/route.ts
git add app/api/admin/dre-health/route.ts
git add components/admin/admin-dashboard.tsx
git add components/admin/dre-panel.tsx
git add components/admin/sales-panel.tsx
git add lib/admin-access.ts
git add lib/dre-db.ts
git add lib/dre-types.ts

git diff --cached --check
git --no-pager diff --cached --name-only
```

Se estiver correto:

```powershell
git commit -m "Adicionar DRE gerencial ao SaborFlow"
git push origin main
```

Aguarde o Railway ficar `SUCCESS`.

## Health check

Entre no Admin e abra:

```text
/api/admin/dre-health
```

Esperado, em estrutura equivalente:

```json
{
  "ok": true,
  "phase": 13,
  "sources": {
    "orders": true,
    "financialEntries": true,
    "inventoryMovements": true,
    "foodCompositionState": true
  },
  "cmv": {
    "ready": true,
    "foodCompositionReady": true
  },
  "regime": "competencia-gerencial"
}
```

`cmv.ready: true` confirma que a infraestrutura existe. A cobertura real do CMV depende de os produtos dos pedidos possuírem ficha técnica.

## Teste funcional recomendado

1. Abra **DRE gerencial** e selecione **Este mês**.
2. Confira se as vendas existentes aparecem sem criar lançamento manual.
3. Em **Vendas e caixa**, crie uma despesa pequena, por exemplo:
   - tipo: Despesa;
   - categoria: `Água, energia e utilidades`;
   - descrição: `Teste DRE`;
   - valor: `1,00`.
4. Volte à DRE e atualize.
5. A despesa deve aparecer no grupo correto e reduzir o resultado líquido em R$ 1,00.
6. Se já houver pedido com ficha técnica, confira o CMV.
7. Exporte o CSV.

Depois do teste, você pode manter o lançamento de R$ 1,00 ou registrar uma receita/despesa real em vez do teste.
