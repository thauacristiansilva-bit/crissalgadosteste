# SaborFlow — FASE 25.2 — Interfaces operacionais dedicadas

Esta fase transforma o RBAC da Fase 25.1 em áreas de trabalho separadas por função, sem alterar o RLS e sem reintroduzir o legado.

## Novas áreas

- `/gerente`: painel gerencial usando o conjunto operacional do gerente.
- `/pdv`: caixa/PDV com venda de balcão e chegada de pedidos.
- `/cozinha`: fila dedicada de produção com iniciar preparo e marcar pronto.
- `/entregador`: tela móvel de entregas prontas/em rota, com iniciar e finalizar entrega.

Ao acessar `/admin`, gerente, caixa, cozinha e entregador são encaminhados para sua área padrão. Owner/Admin permanecem no `/admin`.

## Segurança

- Acesso às páginas é validado no servidor pelo RBAC da Fase 25.1.
- A API de atualização de pedido mantém validação de permissão e passa a reforçar limites do papel:
  - caixa: aceitar, concluir retirada ou cancelar;
  - cozinha: aceito/preparando/pronto;
  - entregador: somente pedido de delivery e somente `ready -> in-route -> completed`.
- O RLS PostgreSQL continua sendo a barreira tenant e não é contornado.
- O PDV recebe leitura do catálogo necessária para vender sem receber `catalog.manage`.
- Sessões de caixa ficam visíveis ao perfil com `cash.manage`, sem conceder leitura financeira completa.

## Health check

`/api/admin/workspaces-health`

## Fora desta fase

- Vínculo individual entre login do entregador e cadastro de entregador: Fase 25.3.
- Distribuição/expedição e múltiplos entregadores: Fase 25.3.
- Roteirização otimizada: Fase 25.4.
- GPS e acompanhamento do cliente em tempo real: Fase 25.5.

Não há migration nesta fase.
