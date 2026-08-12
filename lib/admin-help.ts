export const adminHelp = {
  "cash.openClose": {
    title: "Abrir e fechar caixa",
    text: "Abrir caixa inicia o turno financeiro com o troco disponível. Fechar caixa encerra o turno usando o valor contado no caixa para conferência operacional.",
  },
  "finance.entry": {
    title: "Lançamento financeiro",
    text: "Use para despesas da operação e para receitas que não vieram de pedidos. As vendas já entram automaticamente nos relatórios e na DRE, então não devem ser lançadas novamente.",
  },
  "finance.category": {
    title: "Categoria da DRE",
    text: "Classifica a despesa ou outra receita no grupo correto da DRE gerencial. Escolher uma categoria consistente melhora a leitura dos custos por área.",
  },
  "dre.overview": {
    title: "DRE gerencial",
    text: "Resume receitas, custos e despesas do período para mostrar o resultado da operação. É uma visão gerencial por competência e não substitui a escrituração contábil ou fiscal.",
  },
  "dre.netRevenue": {
    title: "Receita líquida",
    text: "É a receita de vendas após descontos e cupons, somada às outras receitas registradas no financeiro.",
  },
  "dre.cmv": {
    title: "CMV",
    text: "Custo das mercadorias vendidas. No SaborFlow ele é estimado pelas baixas reais dos ingredientes vinculados às fichas técnicas dos pedidos não cancelados.",
  },
  "dre.grossProfit": {
    title: "Lucro bruto",
    text: "É a receita líquida menos o CMV. Mostra quanto sobra das vendas antes das despesas operacionais.",
  },
  "dre.netResult": {
    title: "Resultado líquido gerencial",
    text: "É o valor que sobra depois de considerar CMV, despesas operacionais e outras receitas do período. Valor negativo indica prejuízo gerencial.",
  },
  "dre.grossMargin": {
    title: "Margem bruta",
    text: "Percentual da receita que sobra após descontar o CMV. Ajuda a avaliar preço de venda e custo direto dos produtos.",
  },
  "dre.netMargin": {
    title: "Margem líquida",
    text: "Percentual da receita que permanece depois de todos os custos e despesas considerados na DRE gerencial.",
  },
  "dre.averageTicket": {
    title: "Ticket médio",
    text: "Valor médio dos pedidos não cancelados no período. É calculado dividindo o faturamento dos pedidos pela quantidade de pedidos válidos.",
  },
  "inventory.readyStock": {
    title: "Estoque de produto pronto",
    text: "Use quando existe uma quantidade física do produto já pronto ou embalado. É diferente do estoque de ingredientes usado pela ficha técnica.",
  },
  "inventory.ingredients": {
    title: "Estoque de ingredientes",
    text: "Controla matérias-primas usadas nas fichas técnicas. Quando um pedido é confirmado, o sistema pode baixar automaticamente as quantidades configuradas.",
  },
  "inventory.movements": {
    title: "Movimentações de estoque",
    text: "Entrada aumenta o saldo; Saída registra consumo ou retirada manual; Perda registra desperdício; Ajuste substitui o saldo atual pelo valor contado no inventário.",
  },
  "inventory.minStock": {
    title: "Estoque mínimo",
    text: "É o limite usado para gerar alerta de reposição. Não é uma baixa automática e não altera o saldo disponível.",
  },
  "inventory.unitCost": {
    title: "Custo por unidade",
    text: "Informe o custo na mesma unidade cadastrada para o ingrediente. Ex.: se a unidade é kg, informe o custo de 1 kg; se é g, informe o custo de 1 g.",
  },
  "composition.base": {
    title: "Ficha técnica base",
    text: "Define os ingredientes consumidos em cada unidade vendida do produto, antes de considerar tamanhos e complementos escolhidos pelo cliente.",
  },
  "composition.modifiers": {
    title: "Grupos de complementos",
    text: "Organizam escolhas como tamanho, sabores, adicionais e acompanhamentos. Cada grupo pode ter regras próprias de quantidade e preço.",
  },
  "composition.min": {
    title: "Mínimo de escolhas",
    text: "Quantidade mínima de opções que o cliente precisa selecionar neste grupo. Use 0 quando a escolha for totalmente opcional.",
  },
  "composition.max": {
    title: "Máximo de escolhas",
    text: "Limite de opções que o cliente pode selecionar dentro do grupo. O servidor valida esse limite antes de aceitar o pedido.",
  },
  "composition.included": {
    title: "Incluídos grátis",
    text: "Quantidade de opções elegíveis que podem ocupar vagas gratuitas no grupo. Opções não elegíveis continuam cobradas mesmo quando ainda há vagas grátis.",
  },
  "composition.required": {
    title: "Grupo obrigatório",
    text: "Quando ativado, o cliente precisa atender as regras mínimas do grupo para adicionar o produto ao pedido.",
  },
  "composition.optionPrice": {
    title: "Preço adicional",
    text: "Valor acrescentado ao preço do produto quando esta opção é cobrada. O preço final é recalculado e validado pelo servidor.",
  },
  "composition.freeEligible": {
    title: "Pode usar vaga grátis",
    text: "Permite que esta opção consuma uma das vagas gratuitas do grupo. Desative para itens premium que devem ser cobrados sempre, como Nutella.",
  },
  "composition.optionIngredients": {
    title: "Ingredientes da opção",
    text: "Define o consumo adicional provocado por esta escolha. Evite repetir aqui um ingrediente já colocado na ficha base quando isso causaria baixa em dobro.",
  },
  "products.readyStock": {
    title: "Controlar estoque do produto",
    text: "Ative para produtos prontos com quantidade física própria. Para itens preparados sob demanda, normalmente o controle principal fica nos ingredientes da ficha técnica.",
  },
  "orders.status": {
    title: "Fluxo do pedido",
    text: "O status acompanha a execução do pedido, como aceito, em preparação, pronto, em rota e concluído. Avance apenas quando a etapa operacional realmente ocorrer.",
  },
  "orders.payment": {
    title: "Status do pagamento",
    text: "Marcar como pago confirma que o valor foi efetivamente recebido. Isso não deve ser usado apenas porque o pedido foi criado.",
  },
  "orders.cancel": {
    title: "Cancelar pedido",
    text: "Interrompe o fluxo do pedido. Quando houve consumo automático de ingredientes, o primeiro cancelamento faz o estorno do estoque de forma idempotente.",
  },
  "orders.courier": {
    title: "Atribuir entregador",
    text: "Vincula um entregador ativo ao pedido de delivery para facilitar a operação e o acompanhamento da rota.",
  },
  "delivery.pricing": {
    title: "Preço e cobertura de entrega",
    text: "Define como a taxa de delivery será calculada e quais endereços podem receber pedidos. Escolha apenas um modo de precificação por vez.",
  },
  "delivery.distance": {
    title: "Cobrança por distância",
    text: "Calcula a rota pelas ruas, aplica uma taxa inicial e acrescenta o valor por quilômetro até o limite máximo configurado.",
  },
  "delivery.bands": {
    title: "Faixas por distância",
    text: "Cada intervalo de quilômetros recebe um preço fixo. O sistema escolhe automaticamente a faixa correspondente à rota calculada.",
  },
  "delivery.customAreas": {
    title: "Áreas personalizadas",
    text: "Permite desenhar regiões de entrega no mapa e definir uma taxa para cada área. Endereços fora de todas as áreas ativas são rejeitados.",
  },
  "delivery.freeAbove": {
    title: "Entrega grátis acima de",
    text: "Zera a taxa de entrega quando o subtotal elegível atinge o valor configurado. Use 0 para deixar esse benefício desativado.",
  },
  "delivery.couriers": {
    title: "Entregadores",
    text: "Cadastre quem pode ser atribuído aos pedidos de delivery. Desativar um entregador impede novas atribuições sem apagar o histórico.",
  },
  "settings.acceptingOrders": {
    title: "Operação liberada",
    text: "É a chave operacional que permite receber novos pedidos. A loja também precisa estar dentro do horário configurado e com o canal de retirada ou delivery habilitado.",
  },
  "settings.scheduling": {
    title: "Agendamento",
    text: "Controla intervalo entre horários disponíveis e quantos dias à frente o cliente pode programar um pedido.",
  },
  "settings.autoPrint": {
    title: "Impressão automática",
    text: "Quando ativa, novos pedidos entram na fila do agente local de impressão. Para impressão silenciosa é necessário manter o agente conectado no computador da empresa.",
  },
  "settings.printerName": {
    title: "Nome da impressora",
    text: "Deve corresponder ao nome da impressora instalada no Windows onde o agente de impressão está rodando.",
  },
  "settings.kitchenTicket": {
    title: "Ticket de cozinha",
    text: "Define se o fluxo automático deve gerar uma via operacional com itens e observações para a produção.",
  },
  "settings.customerTicket": {
    title: "Ticket do cliente",
    text: "Define se o fluxo automático deve gerar uma via de atendimento/cliente além da via de cozinha.",
  },
  "team.role": {
    title: "Função do colaborador",
    text: "A função determina o conjunto padrão de permissões e quais áreas do Admin o colaborador pode usar.",
  },
  "team.access": {
    title: "Perfil operacional e login",
    text: "O perfil permite organizar o colaborador na operação. O login é uma credencial individual vinculada ao perfil e pode ser criado, recuperado ou desativado separadamente.",
  },
  "team.invite": {
    title: "Convite de acesso",
    text: "Gera um link temporário para o colaborador criar ou ativar sua credencial. Trate o link como uma credencial e compartilhe apenas com a pessoa correta.",
  },
  "security.timezone": {
    title: "Timezone da empresa",
    text: "Define o fuso usado para horários operacionais, relatórios, agendamentos e impressão. Uma configuração incorreta pode deslocar datas e horários.",
  },
  "security.domain": {
    title: "Domínio customizado",
    text: "Permite usar um endereço próprio para a loja. A verificação TXT comprova a propriedade do domínio, mas o roteamento DNS/hospedagem ainda precisa estar configurado.",
  },
  "security.printAgent": {
    title: "Agente de impressão",
    text: "É o processo local que consulta a fila da empresa e envia os tickets para a impressora. Cada agente usa um token exclusivo da organização.",
  },
  "pdv.delivery": {
    title: "Pedido para entrega no PDV",
    text: "Permite registrar no balcão um pedido que será entregue ao cliente. O endereço e a taxa passam pelas mesmas regras de cobertura usadas pela loja pública.",
  },
  "pdv.deliveryQuote": {
    title: "Localizar e calcular entrega",
    text: "Localiza o endereço, calcula a rota e valida a cobertura antes de permitir o pedido. A taxa é conferida novamente pelo servidor no registro final.",
  },
  "kitchen.flow": {
    title: "Fluxo da cozinha",
    text: "A fila organiza pedidos ativos pelo horário de recebimento. Avance o status conforme a produção: aceitar, iniciar preparo e marcar pronto.",
  },
} as const

export type AdminHelpKey = keyof typeof adminHelp
