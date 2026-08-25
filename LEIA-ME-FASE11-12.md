# SaborFlow — Fases 11 + 12 combinadas — v17.12

## Complementos + montagem de produtos + ficha técnica + estoque de ingredientes

Este pacote foi preparado sobre a **Fase 10 corrigida v17.10.1** e junta as Fases 11 e 12 em uma única atualização aditiva.

### O que entra nesta atualização

**Montagem de produtos**
- grupos de escolhas por produto;
- grupo obrigatório ou opcional;
- mínimo e máximo de escolhas;
- quantidade de escolhas incluídas/grátis;
- adicional pago por opção;
- opção ativa/inativa;
- opção indisponível automaticamente quando faltar ingrediente;
- preço final recalculado e validado no servidor;
- mesma montagem no site público e no PDV.

**Ficha técnica e ingredientes**
- cadastro de ingredientes por empresa;
- unidades: g, kg, ml, L, unidade e porção;
- estoque atual, estoque mínimo e custo por unidade declarada;
- ficha técnica do produto base;
- ingredientes consumidos por cada opção/complemento;
- custo estimado da ficha técnica base e margem bruta estimada;
- baixa automática do ingrediente quando o pedido é confirmado;
- estorno automático do ingrediente no primeiro cancelamento do pedido;
- entrada, saída, perda e ajuste manual;
- histórico de movimentações;
- proteção contra estoque negativo;
- baixa idempotente para não descontar duas vezes o mesmo pedido.

**Pedido / cozinha / impressão**
- o pedido salva uma fotografia dos complementos escolhidos;
- alterações futuras no cadastro do produto não mudam pedidos antigos;
- complementos aparecem no carrinho, acompanhamento, painel de pedidos, cozinha, impressão térmica e ticket PDF.

**Multiempresa**
- todas as novas tabelas usam `organization_id`;
- uma empresa não informa o `organization_id` pelo navegador: o servidor deriva da sessão/loja pública;
- as novas policies RLS ficam preparadas, mas **RLS continua desligado**, igual à Fase 10.

---

## Migration nova

`database/migrations/010_food_composition_inventory.sql`

Cria:
- `sf_modifier_groups`
- `sf_modifier_options`
- `sf_product_modifier_groups`
- `sf_ingredients`
- `sf_product_ingredients`
- `sf_modifier_option_ingredients`
- `sf_order_item_modifiers`
- `sf_inventory_movements`
- `sf_food_composition_state`

A migration não apaga catálogo, pedidos, clientes nem configurações existentes.

---

## Instalação

### 1. Extraia este ZIP na raiz do projeto

Projeto atual:

`C:\Users\thaua\Downloads\cris-salgados-agendamento-entrega-pronto`

Permita substituir os arquivos existentes.

### 2. Build local ANTES do commit

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Os warnings conhecidos do Turbopack sobre filesystem em `app/api/media/[name]/route.ts` e `lib/db.ts` continuam não sendo bloqueadores quando o build termina com sucesso.

Se aparecer `Type error`, `Failed to type check` ou `Build Failed`, **não faça commit**.

### 3. Git — adicionar somente os arquivos desta atualização

```powershell
git add database/migrations/010_food_composition_inventory.sql
git add lib/types.ts
git add lib/product-composition.ts
git add lib/food-composition-db.ts
git add lib/catalog-db.ts
git add lib/tenant-checkout.ts
git add lib/order-db.ts
git add lib/organization-onboarding.ts
git add lib/print-order.ts
git add app/api/products/[id]/composition/route.ts
git add app/api/admin/ingredients/route.ts
git add app/api/admin/ingredients/[id]/route.ts
git add app/api/admin/ingredients/[id]/movement/route.ts
git add app/api/admin/inventory-movements/route.ts
git add app/api/admin/food-composition-health/route.ts
git add app/api/orders/route.ts
git add app/api/orders/[id]/route.ts
git add app/api/orders/[id]/ticket-pdf/route.ts
git add app/api/admin/pdv-order/route.ts
git add components/catalog/product-customizer.tsx
git add components/admin/product-composition-editor.tsx
git add components/admin/products-panel.tsx
git add components/admin/inventory-panel.tsx
git add components/admin/pdv-panel.tsx
git add components/admin/orders-panel.tsx
git add components/admin/kitchen-panel.tsx
git add components/store/storefront.tsx
git add components/store/order-tracker.tsx
git status
```

Não use `git add .`.

Se `next-env.d.ts` aparecer modificado:

```powershell
git restore next-env.d.ts
```

Depois:

```powershell
git commit -m "Adicionar complementos ficha tecnica e estoque de ingredientes"
git push origin main
```

### 4. Railway

Aguarde o deploy ficar `SUCCESS`. Depois, no Console do serviço da aplicação:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado no final:

```text
SKIP 009_security_team_domain_rls - já aplicada
APLICANDO 010_food_composition_inventory...
OK 010_food_composition_inventory
```

Se `009` não estiver aplicada, não avance com os testes das Fases 11/12 até confirmar a Fase 10.

### 5. Health check

Logado no Admin, abra:

`/api/admin/food-composition-health`

Logo após a migration, antes de cadastrar ingredientes, é normal os contadores serem zero. O importante é:

```json
{
  "ok": true,
  "phase": "11-12",
  "foodComposition": {
    "ready": true
  },
  "stock": {
    "automaticConsumption": true,
    "cancellationReversal": true,
    "authoritativePricing": "server"
  },
  "rls": {
    "enforcement": "prepared-only"
  }
}
```

---

## Primeiro teste recomendado — Açaí

### A. Cadastre ingredientes

No Admin, abra **Inventário → Ingredientes**.

Exemplo:
- Açaí — unidade `kg` — estoque `20` — custo `30,00` por kg;
- Banana — unidade `kg`;
- Granola — unidade `kg`;
- Nutella — unidade `kg`.

O custo deve ser informado na mesma unidade escolhida. Se o ingrediente estiver em kg e custar R$ 30/kg, informe `30`. Uma receita de `0,5 kg` terá custo estimado de R$ 15.

### B. Abra Produtos → Montagem

No produto Açaí, clique em **Montagem**.

Você pode montar, por exemplo:

**Grupo: Tamanho**
- obrigatório: sim;
- mínimo: 1;
- máximo: 1;
- 300 ml: preço adicional R$ 0;
- 500 ml: preço adicional conforme sua tabela;
- 700 ml: preço adicional conforme sua tabela.

Se o consumo de açaí variar por tamanho, coloque a quantidade de açaí **na ficha da opção de tamanho**, e não também na ficha técnica base. Isso evita baixa duplicada.

**Grupo: Acompanhamentos**
- mínimo: 0;
- máximo: 5;
- incluídos grátis: 3;
- Banana / Granola / Leite em pó: marque `Pode usar vaga grátis`;
- Nutella: deixe fora da vaga grátis e informe o preço adicional.

Cada opção pode ter sua própria ficha técnica de ingrediente.

### C. Faça um pedido pequeno

Pelo site público:
1. clique em **Montar**;
2. escolha o tamanho e complementos;
3. confirme o pedido;
4. confira o preço no carrinho;
5. confira o pedido no Admin/cozinha;
6. confira a baixa em **Inventário → Ingredientes**.

Depois cancele esse pedido uma única vez e confirme que os ingredientes retornaram ao estoque.

---

## Produto pronto x ingrediente

O SaborFlow agora pode controlar os dois ao mesmo tempo:

- `trackStock=true` no produto: baixa unidades do produto pronto;
- ficha técnica: baixa matérias-primas/ingredientes.

Para açaí e outros itens preparados na hora, normalmente você pode deixar o controle de estoque do **produto pronto** desligado e controlar pelas fichas técnicas dos ingredientes.

Para itens já produzidos/embalados, você pode manter também o estoque do produto pronto.

---

## Segurança de preço

O navegador envia apenas o produto, a quantidade e os IDs das opções escolhidas. O backend:
- busca o produto dentro da empresa correta;
- valida grupos e limites;
- rejeita opção que não pertence ao produto;
- rejeita opção indisponível;
- calcula quais escolhas estão incluídas;
- consulta os preços reais no PostgreSQL;
- calcula novamente o valor final;
- valida e bloqueia estoque insuficiente.

Portanto, alterar preço no navegador não muda o valor aceito pelo servidor.

---

## Importante

- Não apague `/data/store.json`.
- Não remova o Volume do Railway.
- Não ative RLS manualmente nesta fase.
- Não há variável de ambiente nova para as Fases 11/12.
- Não é necessário importar dados antigos para as novas tabelas: produtos existentes continuam simples até você configurar a montagem/ficha técnica deles.
