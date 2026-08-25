# SaborFlow — FASE 20 — Relatórios e inteligência gerencial

Esta fase adiciona uma área analítica separada da operação diária e da DRE detalhada.

## Novas rotas

- `/admin/relatorios` — painel de inteligência gerencial.
- `GET /api/admin/reports` — relatório analítico por período e escopo.
- `GET /api/admin/reports/export` — exportações CSV.
- `GET /api/admin/reports-health` — health check da fase.

## Escopos

- `organization`: somente a organização/loja atual.
- `group`: consolidação das unidades do grupo empresarial da FASE 19, quando disponível.

A leitura corporativa não concede permissão operacional em outra filial.

## Indicadores

- faturamento, pedidos, ticket médio, concluídos e cancelamentos;
- receita paga/não paga, descontos e receita de entrega;
- comparação automática com o período anterior equivalente;
- evolução diária;
- ranking de produtos;
- canais de venda, formas de pagamento e entrega/retirada;
- recorrência de clientes identificados;
- ranking de unidades no escopo corporativo;
- leituras automáticas baseadas nos indicadores;
- entradas/despesas manuais apenas como resumo complementar (a DRE continua sendo a fonte detalhada).

## Exportações

CSV disponível para:

- resumo;
- produtos;
- série diária;
- unidades do grupo.

## Limites e segurança

- requer assinatura ativa;
- requer entitlement `advancedReports`;
- período máximo: 366 dias;
- relatórios são somente leitura;
- queries são filtradas pelos IDs de organizações autorizadas no backend;
- o escopo corporativo usa somente organizações vinculadas ao grupo e à conta de cobrança já validada pela FASE 19;
- RLS permanece prepared-only até a FASE 24.

## Banco de dados

A FASE 20 não cria migration. Ela usa as tabelas já existentes (`sf_orders`, `sf_order_items`, `sf_financial_entries`) e, quando aplicável, a estrutura corporativa da migration 019.

O acesso é restrito aos papéis tenant `owner`, `admin` e `manager`; perfis operacionais não recebem acesso aos indicadores financeiros e gerenciais.
