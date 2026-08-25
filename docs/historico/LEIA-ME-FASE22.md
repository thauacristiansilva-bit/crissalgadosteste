# SaborFlow — FASE 22 — Operação alimentar avançada

## Escopo

Esta fase evolui a ficha técnica e o inventário existentes com:

- recebimento de ingredientes por lote;
- fornecedor, validade e rastreabilidade de lote;
- custo médio ponderado no recebimento;
- perdas vinculadas ao lote e ao movimento de estoque;
- apontamento de produção, rendimento real e custo efetivo;
- inventário físico transacional com ajustes auditáveis;
- alertas de estoque baixo, lote a vencer e lote vencido;
- health check específico da fase.

## Regra importante de estoque

O SaborFlow já possui baixa automática de ingredientes por pedido através da ficha técnica. A FASE 22 não cria uma segunda baixa durante o apontamento de produção. Assim, o estoque oficial continua em `sf_ingredients` e as vendas continuam sendo a autoridade do consumo automático atual.

Os lotes são uma camada de rastreabilidade de recebimento/validade/perda. Eles não substituem o saldo oficial do ingrediente e podem ser encerrados manualmente quando o lote físico deixar de existir.

## Migration

`database/migrations/021_advanced_food_operations.sql`

Cria:

- `sf_ingredient_lots`
- `sf_food_production_runs`
- `sf_inventory_counts`
- `sf_inventory_count_items`

O PostgreSQL RLS permanece preparado, porém desativado até a FASE 24.

## Rotas

- `/admin/operacao-alimentar`
- `/api/admin/food-operations`
- `/api/admin/food-operations/actions`
- `/api/admin/food-operations-health`

## Segurança

- exige sessão tenant PostgreSQL válida;
- exige perfil owner/admin/manager;
- exige assinatura ativa;
- exige entitlement `inventory`;
- mutações exigem same-origin;
- recebimentos, perdas e contagens atualizam estoque no backend/transação;
- produção registra rendimento/custo sem duplicar baixa de ingredientes.
