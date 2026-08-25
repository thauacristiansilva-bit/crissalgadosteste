# FASE 25.7.6 — Pedido agendado: preparo/cancelamento + proteção de sessão

Esta correção deixa explícito que **ser agendado não bloqueia preparo nem cancelamento**.

O erro `A entrega só pode avançar de pronto para em rota e depois para concluído` vinha do backend quando a requisição estava chegando com uma **sessão de entregador**. Isso pode acontecer durante testes quando Admin e Entregador usam o mesmo navegador/perfil: ambos compartilham o cookie `saborflow_admin_session`, então o último login substitui o anterior.

## Regras mantidas

- Owner/Admin/Manager com permissão de status podem iniciar preparo de pedido agendado.
- Conta autorizada de gestão pode cancelar pedido agendado antes da conclusão.
- Caixa continua podendo cancelar pedido ativo conforme a regra já existente.
- Cozinha continua limitada ao fluxo de produção.
- Entregador **não** ganha permissão para cancelar ou preparar; ele continua restrito a `pronto -> em rota -> concluído`.
- A API agora retorna uma mensagem específica quando a sessão atual é de entregador, em vez de sugerir que o problema é o agendamento.
- O painel Admin consulta a sessão ao carregar e a cada 5 segundos. Se outro login substituir a sessão por uma conta de entregador, a tela é redirecionada ao workspace correto e deixa de operar com credenciais trocadas.

## Teste recomendado

Use Admin no navegador normal e Entregador em janela anônima/outro perfil/outro dispositivo.

No Admin, com um pedido agendado:

1. Clique em `Começar preparo` — deve avançar normalmente.
2. Em outro pedido agendado ativo, clique em `Cancelar` — deve ficar `Cancelado`.
3. Abra `/api/admin/order-flow-health` e confirme `scheduledFlagBlocksCancellation: false`.

Não há migration nesta fase.
