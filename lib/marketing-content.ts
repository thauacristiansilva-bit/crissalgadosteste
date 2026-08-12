export const MARKETING_SEGMENTS = [
  "Restaurantes",
  "Lanchonetes",
  "Hamburguerias",
  "Pizzarias",
  "Açaiterias",
  "Sorveterias",
  "Padarias",
  "Confeitarias",
  "Marmitarias",
  "Dark kitchens",
  "Delivery",
] as const

export const MARKETING_FEATURES = [
  {
    title: "Pedidos em um só fluxo",
    description: "Receba pedidos do cardápio online, PDV e operação interna sem perder o contexto da loja.",
    icon: "orders",
  },
  {
    title: "PDV e atendimento",
    description: "Venda no balcão, retirada ou entrega com cliente, endereço, taxa e total validados pelo servidor.",
    icon: "pos",
  },
  {
    title: "Cozinha e produção",
    description: "Acompanhe pedidos por status e mantenha a equipe alinhada do aceite até a conclusão.",
    icon: "kitchen",
  },
  {
    title: "Delivery organizado",
    description: "Configure retirada, entrega, áreas, faixas de distância, entregadores e regras comerciais por loja.",
    icon: "delivery",
  },
  {
    title: "Complementos e ficha técnica",
    description: "Monte grupos de adicionais, limites, itens inclusos e composição de ingredientes com preço autoritativo.",
    icon: "modifiers",
  },
  {
    title: "Estoque conectado à venda",
    description: "Controle ingredientes, custo, mínimo, movimentos, consumo automático e reversão em cancelamentos.",
    icon: "inventory",
  },
  {
    title: "Caixa, financeiro e DRE",
    description: "Acompanhe caixa, lançamentos, receita, CMV, lucro, margem e resultado sem duplicar as vendas dos pedidos.",
    icon: "financial",
  },
  {
    title: "Clientes e relacionamento",
    description: "Centralize clientes, histórico operacional, cupons e a base necessária para fidelidade e CRM.",
    icon: "customers",
  },
  {
    title: "Multiempresa de verdade",
    description: "Separe lojas, usuários, catálogo, operação e permissões com limites comerciais definidos pelo plano.",
    icon: "multi",
  },
] as const

export const MARKETING_SOLUTIONS = [
  {
    title: "Venda online",
    description: "Cardápio público, retirada e delivery conectados diretamente à operação da loja.",
    points: ["Cardápio por loja", "Pedido online", "Cupons", "Agendamento", "Entrega ou retirada"],
  },
  {
    title: "Operação no balcão",
    description: "Um PDV prático para pedidos presenciais sem separar a operação do restante do negócio.",
    points: ["PDV", "Cliente e endereço", "Taxa de entrega", "Pagamento", "Impressão operacional"],
  },
  {
    title: "Produção e entrega",
    description: "Pedidos passam por uma sequência operacional clara, com cozinha e entregadores no mesmo fluxo.",
    points: ["Fila de produção", "Status do pedido", "Entregadores", "Pronto para entrega", "Conclusão"],
  },
  {
    title: "Gestão e margem",
    description: "Transforme a operação diária em informação útil para acompanhar custos e resultado.",
    points: ["Estoque", "Ficha técnica", "CMV", "DRE", "Ticket médio"],
  },
] as const

export const MARKETING_FAQ = [
  {
    question: "O SaborFlow serve apenas para delivery?",
    answer: "Não. A operação pode combinar cardápio online, retirada, delivery e PDV, mantendo os pedidos dentro do mesmo fluxo administrativo.",
  },
  {
    question: "Posso testar antes de contratar?",
    answer: "Sim. A demonstração pública cria um ambiente temporário e isolado com dados fictícios para você testar pedidos, PDV, cozinha, entrega, caixa, complementos e estoque.",
  },
  {
    question: "A demonstração usa dados reais?",
    answer: "Não. O ambiente DEMO é isolado, temporário e bloqueia efeitos externos sensíveis, como domínio próprio e impressão externa.",
  },
  {
    question: "Posso administrar mais de uma loja?",
    answer: "Sim. A arquitetura é multiempresa. A quantidade de lojas, usuários e produtos disponíveis depende dos limites do plano contratado.",
  },
  {
    question: "A assinatura pode ser ativada pelo navegador?",
    answer: "Não. A liberação comercial é autoridade do backend após confirmação do provedor de pagamento. A interface não consegue ativar a própria assinatura.",
  },
  {
    question: "Posso usar meu próprio domínio?",
    answer: "A plataforma possui suporte estrutural a domínio personalizado. A disponibilidade é controlada pelo plano e pela configuração da organização.",
  },
  {
    question: "O estoque conversa com a ficha técnica?",
    answer: "Sim. Ingredientes podem ser associados ao produto e aos complementos, permitindo consumo automático e reversão quando um pedido é cancelado.",
  },
  {
    question: "Existe visão financeira?",
    answer: "Sim. O painel reúne caixa, lançamentos e uma DRE gerencial com receita, CMV, lucro, margens e ticket médio.",
  },
] as const
