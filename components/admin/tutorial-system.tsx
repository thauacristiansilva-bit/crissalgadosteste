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
      { title: "Seus produtos atuais", description: "Primeiro confira a lista. Se você já cadastrou produtos, eles continuam exatamente como estão.", why: "O tutorial nunca apaga nem recria seu cardápio; ele apenas explica a tela real.", target: '[data-tutorial="products-list"]' },
      { title: "Editar um produto existente", description: "Se quiser acompanhar o tutorial usando um produto que já existe, clique no lápis de Editar. Nome, preço, categoria, imagem e estoque serão carregados no formulário.", why: "Assim você aprende usando dados reais, sem precisar cadastrar um produto de teste.", target: '[data-tutorial="product-edit"]' },
      { title: "Nome do produto", description: "Informe um nome claro, como “Coxinha de frango” ou “Combo Família”. Se estiver editando, o nome atual já aparecerá aqui.", why: "Um nome claro facilita a busca do cliente e também a organização da equipe.", target: '[data-tutorial="product-name"]' },
      { title: "Categoria", description: "Escolha em qual categoria o produto deve aparecer no cardápio.", why: "Categorias deixam o cardápio mais fácil de navegar e ajudam o cliente a encontrar o que procura.", target: '[data-tutorial="product-category"]' },
      { title: "Preço", description: "Confira o valor de venda. Você pode apenas olhar e avançar; nada é alterado até clicar em Salvar.", why: "O preço alimenta cardápio, PDV, pedido e relatórios, por isso vale revisar com atenção.", target: '[data-tutorial="product-price"]' },
      { title: "Imagem", description: "Adicione ou troque a foto do produto quando quiser.", why: "Fotos boas ajudam o cliente a entender o produto e melhoram a apresentação do cardápio.", target: '[data-tutorial="product-image"]' },
      { title: "Complementos e montagem", description: "Use Montagem para sabores, adicionais, escolhas obrigatórias, combos e ficha técnica.", why: "É aqui que você transforma um produto simples em opções personalizadas sem criar dezenas de produtos separados.", target: '[data-tutorial="product-composition"]' },
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
      { title: "Criar ou editar", description: "Use o formulário para criar uma categoria nova ou editar uma existente.", why: "Separar Bebidas, Combos, Salgados e outros grupos deixa o cardápio muito mais simples para o cliente.", target: '[data-tutorial="category-form"]' },
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
      { title: "Aceite de pedidos", description: "O aviso mostra se o aceite está automático ou manual. No manual, você pode aceitar os pendentes.", why: "Essa escolha define se a cozinha recebe o pedido imediatamente ou somente depois de uma conferência.", target: '[data-tutorial="orders-acceptance"]' },
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
      { title: "Escolha os produtos", description: "Esta área mostra os produtos disponíveis. Pesquise e adicione os itens do pedido.", why: "O PDV usa os mesmos produtos e complementos do cardápio, evitando cadastro duplicado.", target: '[data-tutorial="pdv-products"]' },
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
      { title: "Identidade visual", description: "Confira logo, capa, cores e mensagem principal da empresa.", why: "Esses dados definem a aparência da loja para o cliente.", target: '[data-tutorial="settings-brand"]' },
      { title: "Informações e localização", description: "Revise endereço e informações públicas da empresa.", why: "Uma localização correta melhora retirada, entrega e confiança do cliente.", target: '[data-tutorial="settings-location"]' },
      { title: "Horários e funcionamento", description: "Defina dias, horários, retirada, delivery, pedido mínimo e forma de aceitar novos pedidos.", why: "Essas regras impedem pedidos fora da operação e deixam a expectativa do cliente mais clara.", target: '[data-tutorial="settings-orders"]' },
      { title: "Formas de pagamento", description: "Escolha quais opções aparecem no checkout da loja.", why: "Mostrar apenas meios que sua empresa realmente aceita evita problemas na finalização do pedido.", target: '[data-tutorial="settings-payments"]' },
      { title: "Impressão", description: "Configure impressão automática, impressora e tipos de ticket quando necessário.", why: "A impressão ajuda a cozinha e o atendimento a receberem pedidos de forma organizada.", target: '[data-tutorial="settings-printing"]' },
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
  const highlightedRef = useRef<HTMLElement | null>(null)
  const previousStyleRef = useRef<{ outline: string; outlineOffset: string; boxShadow: string; position: string; zIndex: string } | null>(null)

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
    if (!activeTutorial || !step) return
    if (currentSection !== activeTutorial.section) {
      onSectionChange(activeTutorial.section)
      return
    }

    const clearHighlight = () => {
      const element = highlightedRef.current
      const previous = previousStyleRef.current
      if (element && previous) {
        element.style.outline = previous.outline
        element.style.outlineOffset = previous.outlineOffset
        element.style.boxShadow = previous.boxShadow
        element.style.position = previous.position
        element.style.zIndex = previous.zIndex
      }
      highlightedRef.current = null
      previousStyleRef.current = null
    }

    clearHighlight()
    if (!step.target) return clearHighlight

    const timer = window.setTimeout(() => {
      const element = document.querySelector(step.target || "") as HTMLElement | null
      if (!element) return
      highlightedRef.current = element
      previousStyleRef.current = {
        outline: element.style.outline,
        outlineOffset: element.style.outlineOffset,
        boxShadow: element.style.boxShadow,
        position: element.style.position,
        zIndex: element.style.zIndex,
      }
      element.style.outline = "4px solid #f97316"
      element.style.outlineOffset = "5px"
      element.style.boxShadow = "0 0 0 10px rgba(249,115,22,.12), 0 18px 50px rgba(47,28,19,.18)"
      if (!element.style.position) element.style.position = "relative"
      element.style.zIndex = "20"
      element.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 180)

    return () => {
      window.clearTimeout(timer)
      clearHighlight()
    }
  }, [activeTutorial, currentSection, onSectionChange, step])

  function closeTutorial() {
    setActiveId(null)
    setStepIndex(0)
  }

  function finishTutorial() {
    if (!activeTutorial) return closeTutorial()
    const next = new Set(completed)
    next.add(activeTutorial.id)
    setCompleted(next)
    try { window.localStorage.setItem("saborflow:tutorials:completed", JSON.stringify([...next])) } catch {}
    closeTutorial()
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
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">O tutorial abre a tela real e destaca cada parte. Você pode avançar sem alterar nada e repetir quantas vezes quiser.</p>
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
        <div className="fixed bottom-5 left-1/2 z-[70] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-[26px] border border-orange-200 bg-white p-5 shadow-2xl shadow-stone-950/25 sm:bottom-7 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-700">{activeTutorial.title} · {stepIndex + 1}/{activeTutorial.steps.length}</p>
              <h3 className="mt-2 text-xl font-black text-stone-950">{step.title}</h3>
            </div>
            <button type="button" onClick={closeTutorial} className="rounded-xl p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Fechar tutorial"><X className="h-5 w-5" /></button>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-700">{step.description}</p>
          <div className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm leading-6 text-orange-950"><strong>Por que isso importa?</strong> {step.why}</div>
          <p className="mt-3 text-xs font-semibold text-stone-400">Você não é obrigado a alterar ou salvar nada. Pular uma etapa mantém tudo exatamente como está.</p>
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
      )}
    </>
  )
}
