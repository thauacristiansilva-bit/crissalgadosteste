"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Boxes,
  ChefHat,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FolderTree,
  LayoutDashboard,
  Link2,
  Megaphone,
  PackageSearch,
  Settings,
  ShoppingCart,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import type { AdminSection } from "@/lib/admin-access"

export type TutorialStep = {
  title: string
  description: string
  why: string
  target?: string
  targets?: string[]
  targetLabels?: string[]
  details?: string[]
  caution?: string
}

export type SystemTutorial = {
  id: string
  section: AdminSection
  title: string
  summary: string
  icon: LucideIcon
  steps: TutorialStep[]
}

export const tutorialCatalog: SystemTutorial[] = [
  {
    id: "visao-geral",
    section: "overview",
    title: "Conhecendo o painel",
    summary: "Entenda os números principais, atalhos e o que acompanhar todos os dias.",
    icon: LayoutDashboard,
    steps: [
      { title: "Visão geral", description: "Esta é a página inicial da operação. Você pode voltar aqui sempre que quiser ter uma visão rápida do negócio.", why: "Ela concentra os indicadores mais importantes sem obrigar você a abrir várias telas.", target: '[data-tutorial="overview-root"]' },
      { title: "Indicadores do dia", description: "Aqui aparecem pedidos, faturamento, pedidos prontos e pagamentos pendentes.", why: "Esses números ajudam a perceber rapidamente se a operação está normal ou se existe algo precisando de atenção.", target: '[data-tutorial="overview-kpis"]' },
      { title: "Atalhos", description: "Use estes atalhos para abrir rapidamente PDV, cozinha, estoque, cardápio e importação.", why: "Economiza cliques nas tarefas que você mais usa no dia a dia.", target: '[data-tutorial="overview-shortcuts"]' },
    ],
  },
  {
    id: "produtos",
    section: "products",
    title: "Produtos, preços e complementos",
    summary: "Aprenda a cadastrar ou editar um produto sem perder o que já está salvo.",
    icon: Boxes,
    steps: [
      { title: "Comece pelo que já existe", description: "Confira a lista antes de cadastrar qualquer coisa. Produtos que já estão na sua empresa continuam exatamente como foram salvos.", why: "Você aprende usando a operação real, sem criar dados de teste nem apagar o que já foi feito.", target: '[data-tutorial="products-list"]', details: ["Veja quais produtos estão ativos ou inativos.", "Confira categoria, preço, estoque e se o produto possui montagem/complementos.", "Se quiser apenas aprender, não precisa clicar em nenhum produto."], caution: "O tutorial nunca cria, edita, ativa ou desativa produto sozinho." },
      { title: "Editar sem perder informações", description: "Para aprender com um produto existente, clique no lápis de Editar. O formulário será preenchido com os dados que já estavam salvos.", why: "Isso permite revisar como o cadastro funciona sem começar do zero.", targets: ['[data-tutorial="product-edit"]', '[data-tutorial="products-form"]'], targetLabels: ["Editar", "Formulário"], details: ["O nome, preço, categoria, descrição e imagem atuais são carregados.", "Nada muda no banco enquanto você não clicar em Salvar alterações.", "Se houver vários produtos, os botões de edição visíveis podem ficar marcados."], caution: "Abrir a edição não salva nenhuma alteração." },
      { title: "Dados principais do produto", description: "Estes três campos formam a base do produto: nome, categoria e preço. Os quadrados numerados mostram a ordem sugerida de conferência.", why: "Esses dados aparecem em várias partes do sistema e precisam estar coerentes para o cliente e para a equipe.", targets: ['[data-tutorial="product-name"]', '[data-tutorial="product-category"]', '[data-tutorial="product-price"]'], targetLabels: ["1. Nome", "2. Categoria", "3. Preço"], details: ["Nome: use algo direto e fácil de reconhecer.", "Categoria: define em qual grupo do cardápio o item aparece.", "Preço: é usado no cardápio, PDV, pedidos e relatórios.", "Se os campos já estiverem preenchidos, apenas confira e avance."], caution: "Não altere o preço só para testar o tutorial. Você pode avançar sem mexer em nada." },
      { title: "Imagem", description: "Adicione ou troque a foto do produto quando quiser.", why: "Fotos boas ajudam o cliente a entender o produto e melhoram a apresentação do cardápio.", target: '[data-tutorial="product-image"]' },
      { title: "Complementos, sabores e montagem", description: "O botão Montagem abre a parte mais avançada do produto: adicionais, sabores, escolhas obrigatórias, combos e composição.", why: "Uma boa montagem reduz cadastros duplicados e impede pedidos incompletos.", target: '[data-tutorial="product-composition"]', details: ["Use grupos para separar escolhas, como ‘Escolha o sabor’ ou ‘Adicione extras’.", "Defina mínimo e máximo quando a escolha for obrigatória.", "Em combos, organize cada parte do pedido em grupos diferentes.", "A ficha técnica pode ser usada para relacionar ingredientes e estoque quando disponível."], caution: "Se o produto não precisa de personalização, você pode pular esta etapa." },
      { title: "Salvar somente se quiser alterar", description: "Se você mudou alguma informação e quer aplicar, clique em Salvar. Se estava apenas aprendendo, pode terminar o tutorial sem salvar nada.", why: "O tutorial é seguro: avançar etapas não altera seus dados.", target: '[data-tutorial="product-save"]' },
    ],
  },
  {
    id: "categorias",
    section: "categories",
    title: "Categorias do cardápio",
    summary: "Organize produtos em grupos e ajuste a ordem de exibição.",
    icon: FolderTree,
    steps: [
      { title: "Categorias existentes", description: "Veja as categorias que já estão cadastradas. Nenhuma delas será modificada pelo tutorial.", why: "A lista ajuda você a enxergar a estrutura atual antes de criar algo novo.", target: '[data-tutorial="categories-list"]' },
      { title: "Lista e formulário trabalham juntos", description: "À esquerda ficam as categorias existentes; à direita você cria ou edita uma categoria. Os dois pontos ficam marcados para mostrar o fluxo completo.", why: "Você consegue conferir o que já existe antes de criar nomes repetidos.", targets: ['[data-tutorial="categories-list"]', '[data-tutorial="category-form"]'], targetLabels: ["Categorias atuais", "Criar / editar"], details: ["Primeiro confira se a categoria já existe.", "Se existir, edite em vez de criar outra parecida.", "Use nomes curtos: Bebidas, Combos, Pizzas, Sobremesas."], caution: "Só o botão Salvar categoria grava uma mudança." },
      { title: "Nome da categoria", description: "Use um nome curto e fácil de entender.", why: "O nome aparece diretamente no cardápio público.", target: '[data-tutorial="category-name"]' },
      { title: "Salvar", description: "Só clique em salvar se realmente quiser criar ou alterar a categoria. Caso contrário, apenas avance.", why: "Você pode fazer todo o tutorial sem modificar o sistema.", target: '[data-tutorial="category-save"]' },
      { title: "Ordenação", description: "Depois você pode escolher a ordem em que as categorias aparecem para o cliente.", why: "Colocar os grupos mais importantes primeiro ajuda a direcionar a compra.", target: '[data-tutorial="category-order"]' },
    ],
  },
  {
    id: "pedidos",
    section: "orders",
    title: "Receber e acompanhar pedidos",
    summary: "Entenda status, filtros, aceite, preparo, entrega e conclusão.",
    icon: ClipboardList,
    steps: [
      { title: "Tela de pedidos", description: "Aqui ficam os pedidos da empresa e seus status em tempo real.", why: "Toda a equipe acompanha a mesma informação e reduz desencontro entre atendimento, cozinha e entrega.", target: '[data-tutorial="orders-root"]' },
      { title: "Busca e filtros", description: "Pesquise cliente, código ou referência e filtre por status.", why: "Facilita encontrar rapidamente um pedido quando o movimento aumenta.", target: '[data-tutorial="orders-filters"]' },
      { title: "Aceite e lista de pedidos", description: "Confira primeiro como novos pedidos são aceitos e depois veja onde eles aparecem. Os dois pontos são ligados porque uma configuração afeta diretamente o fluxo da lista.", why: "Isso evita que a equipe ache que um pedido sumiu quando, na verdade, está aguardando confirmação.", targets: ['[data-tutorial="orders-acceptance"]', '[data-tutorial="orders-list"]'], targetLabels: ["Aceite", "Pedidos"], details: ["Automático: o pedido entra aceito e pode seguir mais rápido para produção.", "Manual: a equipe confere antes de aceitar.", "Depois do aceite, acompanhe preparo, pronto, entrega/retirada e conclusão."], caution: "Escolha o modo que combina com sua operação; não existe uma opção obrigatória para todas as lojas." },
      { title: "Fluxo do pedido", description: "Cada pedido passa por etapas como aceito, em preparo, pronto, em rota e concluído.", why: "Atualizar o status mantém cliente e equipe alinhados sobre o andamento.", target: '[data-tutorial="orders-list"]' },
    ],
  },
  {
    id: "pdv",
    section: "pdv",
    title: "Fazer uma venda no PDV",
    summary: "Monte um pedido de balcão, retirada ou entrega passo a passo.",
    icon: ShoppingCart,
    steps: [
      { title: "Produtos e carrinho", description: "No PDV você trabalha principalmente entre a lista de produtos e o carrinho. Os dois locais ficam marcados ao mesmo tempo.", why: "Isso ajuda a entender o caminho de uma venda: escolher item → configurar → conferir no carrinho.", targets: ['[data-tutorial="pdv-products"]', '[data-tutorial="pdv-cart"]'], targetLabels: ["Produtos", "Carrinho"], details: ["Pesquise ou selecione um produto.", "Se houver complementos, faça as escolhas solicitadas.", "Confira quantidade, observações e valor no carrinho.", "Você pode sair do tutorial sem finalizar um pedido."], caution: "Não clique em finalizar se estiver apenas aprendendo e não quiser registrar uma venda." },
      { title: "Tipo do pedido", description: "Escolha Retirada ou Entrega conforme o atendimento.", why: "Isso define quais dados e cálculos o sistema precisa pedir em seguida.", target: '[data-tutorial="pdv-order-type"]' },
      { title: "Carrinho", description: "Confira itens, quantidades, complementos e valores antes de finalizar.", why: "Essa revisão reduz erros no envio para cozinha e na cobrança.", target: '[data-tutorial="pdv-cart"]' },
      { title: "Cliente e entrega", description: "Em pedidos de entrega, informe ou selecione o cliente e calcule a taxa pelo endereço.", why: "O sistema guarda a informação correta para produção, entrega e histórico do cliente.", target: '[data-tutorial="pdv-delivery"]' },
      { title: "Finalização", description: "Revise o total e registre o pedido somente quando estiver tudo certo.", why: "Após finalizar, o pedido entra no fluxo operacional da empresa.", target: '[data-tutorial="pdv-finish"]' },
    ],
  },
  {
    id: "configuracoes",
    section: "settings",
    title: "Configurações da loja",
    summary: "Passe pelas principais configurações usando os valores que já estão salvos.",
    icon: Settings,
    steps: [
      { title: "Identidade visual e publicação", description: "Revise logo, capa, cores, título e texto de apresentação. O tutorial marca a área de identidade e também o botão de salvar, porque a mudança só vai ao ar quando você decidir salvar.", why: "A identidade visual é a primeira impressão que o cliente tem da sua loja.", targets: ['[data-tutorial="settings-brand"]', '[data-tutorial="settings-save"]'], targetLabels: ["Identidade visual", "Salvar quando quiser"], details: ["Logo: prefira imagem legível em tamanho pequeno.", "Capa: use foto horizontal com boa qualidade.", "Cores: mantenha contraste para textos e botões continuarem fáceis de ler.", "Título e texto: explique rapidamente o que a empresa vende e seu diferencial."], caution: "Você pode experimentar na tela e sair sem salvar; nesse caso, a loja pública permanece como estava." },
      { title: "Localização e entrega", description: "Endereço e regras de entrega trabalham juntos. Confira a localização da empresa e depois as zonas/taxas de entrega.", why: "Endereço incorreto ou taxa mal configurada pode gerar entrega errada ou cobrança indevida.", targets: ['[data-tutorial="settings-location"]', '[data-tutorial="settings-delivery"]'], targetLabels: ["Localização", "Regras de entrega"], details: ["Confirme CEP, rua, número, bairro e cidade.", "Revise retirada no local antes de ativá-la.", "Nas entregas, confira zonas, taxas e responsáveis quando disponíveis."], caution: "Não invente uma área de entrega apenas para concluir o tutorial; pule se ainda não definiu a logística." },
      { title: "Horários e funcionamento", description: "Defina dias, horários, retirada, delivery, pedido mínimo e forma de aceitar novos pedidos.", why: "Essas regras impedem pedidos fora da operação e deixam a expectativa do cliente mais clara.", target: '[data-tutorial="settings-orders"]' },
      { title: "Formas de pagamento da loja", description: "Ative somente os meios de pagamento que o seu cliente realmente poderá usar e confira a chave PIX quando essa opção estiver ativa.", why: "Um método exibido incorretamente pode fazer o cliente finalizar um pedido que a empresa não consegue receber.", targets: ['[data-tutorial="settings-payments"]', '[data-tutorial="settings-save"]'], targetLabels: ["Meios aceitos", "Salvar"], details: ["PIX: confira se a chave pertence à empresa correta.", "Dinheiro: use quando houver recebimento presencial/entrega.", "Cartão na entrega: use somente se sua operação tiver maquininha ou processo correspondente."], caution: "Esta configuração é para pagamentos dos pedidos da loja; a cobrança da assinatura do SaborFlow é outra área." },
      { title: "Impressora e tickets", description: "Revise a impressão automática, o nome da impressora, a quantidade de cópias e quais tickets devem ser gerados.", why: "A configuração certa evita impressão pequena, duplicada ou enviada para a impressora errada.", targets: ['[data-tutorial="settings-printing"]', '[data-tutorial="settings-save"]'], targetLabels: ["Impressão", "Salvar"], details: ["Impressão automática envia novos pedidos para a fila do agente local.", "Nome da impressora precisa corresponder ao equipamento configurado no computador.", "Ticket de cozinha prioriza produção; ticket do cliente pode conter resumo da compra.", "Use apenas as cópias realmente necessárias para evitar desperdício."], caution: "Se ainda não instalou/configurou a impressora, apenas leia e pule esta etapa." },
      { title: "Salvar alterações", description: "As configurações atuais permanecem preenchidas. Só salve se você realmente alterou algo.", why: "Abrir ou concluir o tutorial nunca sobrescreve configurações existentes.", target: '[data-tutorial="settings-save"]' },
    ],
  },
  {
    id: "layout-loja",
    section: "settings",
    title: "Logo, cores e layout",
    summary: "Aprenda a ajustar a apresentação da loja sem perder o visual atual.",
    icon: Sparkles,
    steps: [
      { title: "Identidade visual atual", description: "O SaborFlow carrega a logo, capa, textos e cores que já estão salvos. Você pode apenas conferir ou fazer ajustes.", why: "Trabalhar sobre o que já existe evita precisar reconstruir a identidade toda vez.", target: '[data-tutorial="settings-brand"]' },
      { title: "Salvar somente se alterar", description: "Se apenas acompanhou o tutorial, não precisa salvar. Se mudou alguma cor, imagem ou texto, use o botão de salvar.", why: "O tutorial não sobrescreve a identidade visual sozinho.", target: '[data-tutorial="settings-save"]' },
    ],
  },
  {
    id: "entrega-localizacao",
    section: "settings",
    title: "Localização, retirada e delivery",
    summary: "Revise endereço, horários e regras de entrega passo a passo.",
    icon: Link2,
    steps: [
      { title: "Localização da empresa", description: "Confira o endereço e o ponto da sua empresa. Os valores atuais já ficam preenchidos.", why: "A localização é usada como referência para retirada e para os cálculos de entrega.", target: '[data-tutorial="settings-location"]' },
      { title: "Horários e canais", description: "Revise quando a loja recebe pedidos e se retirada, delivery ou consumo local estão ativos.", why: "Isso evita receber pedidos em horários ou modalidades que a empresa não consegue atender.", target: '[data-tutorial="settings-orders"]' },
      { title: "Regras de entrega", description: "Aqui ficam zonas, taxas, entregadores e demais regras logísticas disponíveis para sua operação.", why: "Uma regra de entrega clara reduz cobrança errada e organiza o despacho.", target: '[data-tutorial="settings-delivery"]' },
    ],
  },
  {
    id: "pagamentos-loja",
    section: "settings",
    title: "Pagamentos do cardápio",
    summary: "Entenda quais formas de pagamento o cliente verá ao fazer um pedido.",
    icon: CreditCard,
    steps: [
      { title: "Métodos aceitos", description: "Ative apenas as formas que sua loja realmente aceita no pedido, como PIX, dinheiro ou cartão na entrega.", why: "Isso evita o cliente finalizar com um meio de pagamento que a equipe não consegue receber.", target: '[data-tutorial="settings-payments"]' },
      { title: "Salvar alterações", description: "Se não mudou nenhuma opção, pode concluir sem salvar.", why: "O tutorial é apenas orientativo e não muda seus meios de pagamento automaticamente.", target: '[data-tutorial="settings-save"]' },
    ],
  },
  {
    id: "impressao",
    section: "settings",
    title: "Impressora e tickets",
    summary: "Veja onde configurar impressão automática e tickets da cozinha/cliente.",
    icon: BookOpenCheck,
    steps: [
      { title: "Configuração da impressora", description: "Revise impressão automática, nome da impressora, número de cópias e os tickets que deseja usar.", why: "Uma impressão bem configurada ajuda a cozinha a receber pedidos legíveis e no tamanho correto.", target: '[data-tutorial="settings-printing"]' },
      { title: "Salvar somente quando necessário", description: "Se você só veio aprender, pode concluir o tutorial sem salvar.", why: "Nenhuma configuração de impressora é alterada pelo tutorial sozinho.", target: '[data-tutorial="settings-save"]' },
    ],
  },
  {
    id: "clientes",
    section: "customers",
    title: "Clientes e histórico",
    summary: "Entenda cadastro, recorrência e informações que ajudam no atendimento.",
    icon: Users,
    steps: [
      { title: "Base de clientes", description: "Aqui você acompanha os clientes já registrados na empresa.", why: "O histórico ajuda a equipe a atender com mais contexto e acompanhar recorrência.", target: '[data-tutorial="customers-root"]' },
      { title: "Use os dados existentes", description: "O tutorial não cria clientes fictícios nem altera cadastros. Explore a tela usando sua base atual.", why: "Você aprende sem contaminar seus dados reais.", target: '[data-tutorial="customers-root"]' },
    ],
  },
  {
    id: "marketing",
    section: "marketing",
    title: "Cupons e campanhas",
    summary: "Aprenda onde criar ações comerciais e entender quando usar cada recurso.",
    icon: Megaphone,
    steps: [
      { title: "Marketing", description: "Esta área concentra recursos promocionais disponíveis para a empresa.", why: "Centralizar campanhas ajuda a evitar promoções espalhadas e difíceis de controlar.", target: '[data-tutorial="marketing-root"]' },
      { title: "Crie somente quando precisar", description: "Você pode navegar e entender as opções sem publicar nenhuma campanha.", why: "O tutorial serve para ensinar, não para obrigar a executar uma ação.", target: '[data-tutorial="marketing-root"]' },
    ],
  },
  {
    id: "link-loja",
    section: "links",
    title: "Link e presença da loja",
    summary: "Saiba onde copiar e divulgar o endereço público da sua loja.",
    icon: Link2,
    steps: [
      { title: "Seu link público", description: "Aqui ficam os acessos usados para compartilhar sua loja com os clientes.", why: "Um link único facilita divulgar no Instagram, WhatsApp, Google e materiais impressos.", target: '[data-tutorial="links-root"]' },
    ],
  },
  {
    id: "equipe",
    section: "team",
    title: "Equipe e acessos",
    summary: "Entenda como organizar usuários e permissões sem compartilhar uma única senha.",
    icon: Users,
    steps: [
      { title: "Equipe", description: "Cadastre e organize quem trabalha na operação e quais acessos cada pessoa possui.", why: "Acesso individual melhora segurança e permite separar funções dentro da empresa.", target: '[data-tutorial="team-root"]' },
    ],
  },
  {
    id: "estoque",
    section: "inventory",
    title: "Estoque",
    summary: "Entenda saldo, produtos controlados e quando atualizar movimentações.",
    icon: PackageSearch,
    steps: [
      { title: "Controle de estoque", description: "Veja quais itens estão com controle de estoque ativo e acompanhe quantidades.", why: "Evita vender itens indisponíveis e ajuda a planejar reposição.", target: '[data-tutorial="inventory-root"]' },
    ],
  },
  {
    id: "cozinha",
    section: "kitchen",
    title: "Cozinha e produção",
    summary: "Veja como a cozinha acompanha o pedido até ficar pronto.",
    icon: ChefHat,
    steps: [
      { title: "Painel da cozinha", description: "Esta tela organiza pedidos por etapa de produção.", why: "A equipe produz olhando para o mesmo pedido que chegou do atendimento ou do cliente.", target: '[data-tutorial="kitchen-root"]' },
    ],
  },
  {
    id: "atendimento-automatico",
    section: "chatbot",
    title: "Atendimento automático",
    summary: "Entenda onde configurar o comportamento do atendimento e o que o cliente verá.",
    icon: Sparkles,
    steps: [
      { title: "Atendimento automático", description: "Revise as opções disponíveis e configure somente o que fizer sentido para sua operação.", why: "Um atendimento bem configurado reduz perguntas repetitivas e mantém o tom da empresa.", target: '[data-tutorial="chatbot-root"]' },
    ],
  },
  {
    id: "plano-cobranca",
    section: "billing",
    title: "Plano e cobrança",
    summary: "Confira dias restantes, plano, ciclo e informações de cobrança.",
    icon: CreditCard,
    steps: [
      { title: "Seu plano", description: "Aqui você acompanha teste grátis, contratação, ciclo e situação da assinatura.", why: "Deixa claro o que está ativo e quando haverá renovação ou mudança de plano.", target: '[data-tutorial="billing-root"]' },
    ],
  },
]

function tutorialEvent(id: string) {
  window.dispatchEvent(new CustomEvent("saborflow:start-tutorial", { detail: { id } }))
}

export function startSystemTutorial(id: string) {
  if (typeof window !== "undefined") tutorialEvent(id)
}

export function openTutorialCatalog() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("saborflow:open-tutorials"))
}

type SpotlightRect = {
  top: number
  left: number
  width: number
  height: number
  label: string
  index: number
}

type StoredInlineStyle = {
  element: HTMLElement
  position: string
  zIndex: string
}

function stepSelectors(step: TutorialStep | null) {
  if (!step) return []
  if (step.targets?.length) return step.targets
  return step.target ? [step.target] : []
}

function visibleElements(selector: string) {
  return [...document.querySelectorAll(selector)]
    .filter((item): item is HTMLElement => item instanceof HTMLElement)
    .filter((element) => {
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden"
    })
    .slice(0, 8)
}

export function TutorialSystem({
  currentSection,
  onSectionChange,
  allowedSections,
}: {
  currentSection: AdminSection
  onSectionChange: (section: AdminSection) => void
  allowedSections: Set<AdminSection>
}) {
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [spotlights, setSpotlights] = useState<SpotlightRect[]>([])
  const [feedbackTutorial, setFeedbackTutorial] = useState<SystemTutorial | null>(null)
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackHelpful, setFeedbackHelpful] = useState<"yes" | "partly" | "no" | null>(null)
  const [feedbackComment, setFeedbackComment] = useState("")
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const highlightedStylesRef = useRef<StoredInlineStyle[]>([])
  const highlightedElementsRef = useRef<HTMLElement[]>([])

  const availableTutorials = useMemo(
    () => tutorialCatalog.filter((tutorial) => allowedSections.has(tutorial.section)),
    [allowedSections],
  )
  const activeTutorial = useMemo(
    () => availableTutorials.find((tutorial) => tutorial.id === activeId) || null,
    [activeId, availableTutorials],
  )
  const step = activeTutorial?.steps[stepIndex] || null

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("saborflow:tutorials:completed")
      if (raw) setCompleted(new Set(JSON.parse(raw) as string[]))
    } catch {}
  }, [])

  useEffect(() => {
    const start = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail
      const tutorial = availableTutorials.find((item) => item.id === detail?.id)
      if (!tutorial) return
      setCatalogOpen(false)
      setActiveId(tutorial.id)
      setStepIndex(0)
      onSectionChange(tutorial.section)
    }
    const open = () => setCatalogOpen(true)
    window.addEventListener("saborflow:start-tutorial", start)
    window.addEventListener("saborflow:open-tutorials", open)
    return () => {
      window.removeEventListener("saborflow:start-tutorial", start)
      window.removeEventListener("saborflow:open-tutorials", open)
    }
  }, [availableTutorials, onSectionChange])

  useEffect(() => {
    function clearHighlightedElements() {
      for (const saved of highlightedStylesRef.current) {
        saved.element.style.position = saved.position
        saved.element.style.zIndex = saved.zIndex
      }
      highlightedStylesRef.current = []
      highlightedElementsRef.current = []
      setSpotlights([])
    }

    if (!activeTutorial || !step) {
      clearHighlightedElements()
      return
    }
    if (currentSection !== activeTutorial.section) {
      onSectionChange(activeTutorial.section)
      return
    }

    clearHighlightedElements()
    const activeStep = step
    const selectors = stepSelectors(activeStep)
    if (!selectors.length) return

    let cancelled = false
    let resizeObserver: ResizeObserver | null = null

    function updateRects() {
      if (cancelled) return
      const next: SpotlightRect[] = []
      let counter = 0
      selectors.forEach((selector, selectorIndex) => {
        const elements = visibleElements(selector)
        elements.forEach((element, elementIndex) => {
          counter += 1
          const rect = element.getBoundingClientRect()
          const padding = 6
          const baseLabel = activeStep.targetLabels?.[selectorIndex]
          const suffix = elements.length > 1 ? ` ${elementIndex + 1}` : ""
          next.push({
            top: Math.max(4, rect.top - padding),
            left: Math.max(4, rect.left - padding),
            width: Math.min(window.innerWidth - 8, rect.width + padding * 2),
            height: rect.height + padding * 2,
            label: `${baseLabel || `Área ${counter}`}${suffix}`,
            index: counter,
          })
        })
      })
      setSpotlights(next)
    }

    const timer = window.setTimeout(() => {
      if (cancelled) return
      const elements = selectors.flatMap((selector) => visibleElements(selector))
      highlightedElementsRef.current = elements
      highlightedStylesRef.current = elements.map((element) => ({
        element,
        position: element.style.position,
        zIndex: element.style.zIndex,
      }))
      for (const element of elements) {
        if (window.getComputedStyle(element).position === "static") element.style.position = "relative"
        element.style.zIndex = "62"
      }
      const first = elements[0]
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
      window.setTimeout(updateRects, 280)
      resizeObserver = new ResizeObserver(updateRects)
      elements.forEach((element) => resizeObserver?.observe(element))
    }, 160)

    const onViewportChange = () => window.requestAnimationFrame(updateRects)
    window.addEventListener("resize", onViewportChange)
    window.addEventListener("scroll", onViewportChange, true)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.removeEventListener("resize", onViewportChange)
      window.removeEventListener("scroll", onViewportChange, true)
      resizeObserver?.disconnect()
      clearHighlightedElements()
    }
  }, [activeTutorial, currentSection, onSectionChange, step])

  function closeTutorial() {
    setActiveId(null)
    setStepIndex(0)
    setSpotlights([])
  }

  function finishTutorial() {
    if (!activeTutorial) return closeTutorial()
    const finished = activeTutorial
    const next = new Set(completed)
    next.add(finished.id)
    setCompleted(next)
    try { window.localStorage.setItem("saborflow:tutorials:completed", JSON.stringify([...next])) } catch {}
    closeTutorial()
    setFeedbackTutorial(finished)
    setFeedbackRating(0)
    setFeedbackHelpful(null)
    setFeedbackComment("")
    setFeedbackMessage("")
  }

  async function submitFeedback() {
    if (!feedbackTutorial || feedbackBusy) return
    if (!feedbackRating && !feedbackHelpful && !feedbackComment.trim()) {
      setFeedbackMessage("Escolha uma nota, uma opção ou escreva um comentário — ou pule a avaliação.")
      return
    }
    setFeedbackBusy(true)
    setFeedbackMessage("")
    try {
      const response = await fetch("/api/admin/tutorial-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutorialId: feedbackTutorial.id,
          tutorialTitle: feedbackTutorial.title,
          rating: feedbackRating || null,
          helpful: feedbackHelpful,
          comment: feedbackComment.trim(),
          stepCount: feedbackTutorial.steps.length,
        }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar a avaliação.")
      setFeedbackMessage("Obrigado. Sua avaliação foi enviada.")
      window.setTimeout(() => setFeedbackTutorial(null), 700)
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "Não foi possível enviar a avaliação.")
    } finally {
      setFeedbackBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setCatalogOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-3 text-sm font-black text-white shadow-2xl shadow-orange-950/20 transition hover:bg-orange-700"
      >
        <CircleHelp className="h-5 w-5" /> Tutorial
      </button>

      {catalogOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-stone-950/35 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-[30px] border border-orange-100 bg-[#fffaf3] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-orange-100 bg-white p-5 sm:p-7">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Tutoriais interativos</p>
                <h2 className="mt-2 text-2xl font-black text-stone-950 sm:text-3xl">O que você quer aprender agora?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">O tutorial usa a tela real, marca exatamente onde olhar e mantém seus dados atuais. Você pode pular qualquer etapa e repetir quando quiser.</p>
              </div>
              <button type="button" onClick={() => setCatalogOpen(false)} className="rounded-xl border border-stone-200 bg-white p-2 text-stone-500 hover:bg-stone-50" aria-label="Fechar tutoriais"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-5 sm:p-7">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {availableTutorials.map((tutorial) => {
                  const Icon = tutorial.icon
                  const done = completed.has(tutorial.id)
                  return (
                    <button key={tutorial.id} type="button" onClick={() => tutorialEvent(tutorial.id)} className="rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><Icon className="h-5 w-5" /></span>
                        {done && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">Concluído</span>}
                      </div>
                      <h3 className="mt-4 text-base font-black text-stone-950">{tutorial.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-stone-600">{tutorial.summary}</p>
                      <p className="mt-4 text-xs font-black text-orange-700">{tutorial.steps.length} etapa{tutorial.steps.length === 1 ? "" : "s"} · Iniciar tutorial</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTutorial && step && (
        <>
          <div className="pointer-events-none fixed inset-0 z-[50] bg-stone-950/35" aria-hidden="true" />
          {spotlights.map((rect) => (
            <div
              key={`${rect.index}-${rect.top}-${rect.left}`}
              className="pointer-events-none fixed z-[66] rounded-xl border-[3px] border-orange-500 bg-transparent shadow-[0_0_0_4px_rgba(255,255,255,.92),0_0_0_9px_rgba(249,115,22,.28),0_20px_55px_rgba(0,0,0,.22)]"
              style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
            >
              <span className="absolute -top-3 left-3 inline-flex max-w-[240px] items-center gap-1.5 rounded-full bg-orange-600 px-2.5 py-1 text-[10px] font-black text-white shadow-lg">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] text-orange-700">{rect.index}</span>
                <span className="truncate">{rect.label}</span>
              </span>
            </div>
          ))}

          <div className="fixed bottom-4 left-1/2 z-[70] max-h-[78vh] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 overflow-y-auto rounded-[26px] border border-orange-200 bg-white p-5 shadow-2xl shadow-stone-950/30 sm:bottom-6 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-700">{activeTutorial.title} · {stepIndex + 1}/{activeTutorial.steps.length}</p>
                <h3 className="mt-2 text-xl font-black text-stone-950">{step.title}</h3>
              </div>
              <button type="button" onClick={closeTutorial} className="rounded-xl p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Fechar tutorial"><X className="h-5 w-5" /></button>
            </div>

            <p className="mt-3 text-sm leading-6 text-stone-700">{step.description}</p>

            {step.details?.length ? (
              <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-stone-500">O que observar nesta etapa</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
                  {step.details.map((detail) => <li key={detail} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />{detail}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm leading-6 text-orange-950"><strong>Por que isso importa?</strong> {step.why}</div>
            {step.caution && <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900"><strong>Atenção:</strong> {step.caution}</div>}
            <p className="mt-3 text-xs font-semibold text-stone-400">Os quadrados laranja mostram exatamente as áreas relacionadas. Você não é obrigado a preencher, alterar ou salvar nada para avançar.</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((value) => Math.max(0, value - 1))} className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-xs font-black text-stone-700 disabled:opacity-35"><ArrowLeft className="h-4 w-4" />Voltar</button>
              {stepIndex < activeTutorial.steps.length - 1 ? (
                <>
                  <button type="button" onClick={() => setStepIndex((value) => Math.min(activeTutorial.steps.length - 1, value + 1))} className="h-10 rounded-xl px-3 text-xs font-black text-stone-500 hover:bg-stone-50">Pular</button>
                  <button type="button" onClick={() => setStepIndex((value) => Math.min(activeTutorial.steps.length - 1, value + 1))} className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-orange-600 px-4 text-xs font-black text-white hover:bg-orange-700">Próximo <ArrowRight className="h-4 w-4" /></button>
                </>
              ) : (
                <button type="button" onClick={finishTutorial} className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700"><BookOpenCheck className="h-4 w-4" />Concluir tutorial</button>
              )}
            </div>
          </div>
        </>
      )}

      {feedbackTutorial && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-stone-950/40 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="w-full max-w-lg rounded-[28px] border border-orange-100 bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">Avaliação opcional</p>
                <h3 className="mt-2 text-2xl font-black text-stone-950">Esse tutorial ajudou?</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">Sua resposta ajuda a deixar o passo a passo de <strong>{feedbackTutorial.title}</strong> mais claro para os próximos usuários.</p>
              </div>
              <button type="button" onClick={() => setFeedbackTutorial(null)} className="rounded-xl p-2 text-stone-400 hover:bg-stone-100" aria-label="Fechar avaliação"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">Nota</p>
              <div className="mt-2 flex gap-2" aria-label="Nota do tutorial">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button key={rating} type="button" onClick={() => setFeedbackRating(rating)} className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition ${feedbackRating >= rating ? "border-amber-300 bg-amber-50 text-amber-500" : "border-stone-200 bg-white text-stone-300"}`} aria-label={`${rating} estrela${rating > 1 ? "s" : ""}`}>★</button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">Conseguiu entender o que fazer?</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([['yes', 'Sim'], ['partly', 'Em parte'], ['no', 'Não']] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setFeedbackHelpful(value)} className={`rounded-xl border px-3 py-2.5 text-xs font-black ${feedbackHelpful === value ? "border-orange-300 bg-orange-50 text-orange-800" : "border-stone-200 text-stone-600"}`}>{label}</button>
                ))}
              </div>
            </div>

            <label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-stone-500">Comentário <span className="font-semibold normal-case tracking-normal text-stone-400">(opcional)</span>
              <textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value.slice(0, 1000))} rows={3} className="mt-2 w-full resize-none rounded-2xl border border-stone-200 px-3 py-3 text-sm font-normal normal-case tracking-normal text-stone-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100" placeholder="O que ficou claro ou o que poderia melhorar?" />
            </label>

            {feedbackMessage && <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-xs font-bold text-stone-600">{feedbackMessage}</p>}

            <div className="mt-5 flex items-center gap-2">
              <button type="button" onClick={() => setFeedbackTutorial(null)} className="h-10 rounded-xl px-4 text-xs font-black text-stone-500 hover:bg-stone-50">Agora não</button>
              <button type="button" disabled={feedbackBusy} onClick={submitFeedback} className="ml-auto h-10 rounded-xl bg-orange-600 px-5 text-xs font-black text-white hover:bg-orange-700 disabled:opacity-50">{feedbackBusy ? "Enviando..." : "Enviar avaliação"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
