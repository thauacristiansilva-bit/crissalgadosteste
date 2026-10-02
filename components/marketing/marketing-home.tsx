import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Bike,
  Bot,
  Check,
  ChefHat,
  ClipboardList,
  Clock,
  LayoutDashboard,
  MapPin,
  Printer,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  User,
  Users,
} from "lucide-react"
import { MarketingShell } from "@/components/marketing/marketing-shell"

const overview = [
  {
    icon: LayoutDashboard,
    title: "Central de Controle",
    text: "Acompanhe pedidos, vendas e a operação em um só lugar.",
    href: "#central",
    tone: "bg-orange-50 text-orange-700",
  },
  {
    icon: Bike,
    title: "Motoboys e delivery",
    text: "Organize entregas, responsáveis e o andamento de cada pedido.",
    href: "#motoboys",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    icon: Users,
    title: "Clientes",
    text: "Tenha histórico, recorrência e informações para atender melhor.",
    href: "#clientes",
    tone: "bg-violet-50 text-violet-700",
  },
  {
    icon: User,
    title: "Funcionários e equipe",
    text: "Mantenha atendimento, cozinha, caixa e entrega no mesmo fluxo.",
    href: "#equipe",
    tone: "bg-sky-50 text-sky-700",
  },
]

const segments = ["Salgaderias", "Lanchonetes", "Hamburguerias", "Restaurantes", "Pizzarias", "Açaí e sorvetes", "Confeitarias"]

const moduleHighlights = [
  "IA assistente para apoiar a rotina",
  "Configurações, documentos e organização",
  "Pedidos, delivery e notificações",
  "Clientes, equipe e atendimento",
  "Cardápio, relatórios e impressão",
  "Financeiro, calendário e suporte",
]

function StartButton({ className = "", label = "Começar grátis" }: { className?: string; label?: string }) {
  return (
    <Link
      href="/teste-gratis"
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-orange-700 ${className}`}
    >
      {label}
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </Link>
  )
}

function SecondaryButton({ className = "", label = "Ver demonstração", href = "/demo" }: { className?: string; label?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-6 py-3.5 text-sm font-black text-stone-800 transition hover:border-orange-300 hover:bg-orange-50 ${className}`}
    >
      {label}
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </Link>
  )
}

function CheckLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-6 text-stone-700">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white">
        <Check aria-hidden="true" className="h-3 w-3" />
      </span>
      <span>{children}</span>
    </li>
  )
}

function TrialBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-black text-orange-800 shadow-sm">
      <span className="h-2 w-2 rounded-full bg-orange-600" />
      7 dias grátis para testar a gestão simples
    </span>
  )
}

export function MarketingHome() {
  return (
    <MarketingShell>
      <main>
        <section className="overflow-hidden border-b border-orange-100 bg-[#fffaf3]">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[0.94fr_1.06fr] lg:gap-14 lg:px-8 lg:pb-16 lg:pt-16">
            <div className="relative z-10">
              <TrialBadge />
              <h1 className="mt-6 text-4xl font-black leading-[1.03] tracking-[-0.045em] text-stone-950 sm:text-5xl xl:text-6xl">
                Seu negócio organizado.
                <span className="mt-1 block text-orange-600">Seus pedidos no controle.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
                Gerencie cardápio, pedidos, clientes, equipe, delivery e operação em um só lugar. O SaborFlow foi criado para deixar a rotina mais simples do pedido à entrega.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <StartButton className="sm:min-w-40" label="Começar 7 dias grátis" />
                <SecondaryButton />
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-stone-500 sm:text-sm">
                {["7 dias grátis", "Sem cartão", "Gestão simples incluída", "IA opcional"].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <Check aria-hidden="true" className="h-4 w-4 text-orange-600" />
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-7 rounded-[28px] border-2 border-orange-200 bg-white p-5 shadow-lg shadow-orange-950/5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Destaque do momento</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-stone-950">Teste grátis por 7 dias</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
                      Crie seu acesso e conheça a gestão simples do SaborFlow antes de contratar. Veja pedidos, cardápio, atendimento, equipe e a operação funcionando no mesmo fluxo.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-orange-600 px-4 py-3 text-center text-white shadow-sm sm:min-w-[150px]">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-100">Oferta</p>
                    <p className="mt-1 text-2xl font-black">7 dias</p>
                    <p className="text-xs font-bold text-orange-100">grátis</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-500">Acesso inicial</p>
                    <p className="mt-1 text-base font-black text-stone-950">Gestão simples liberada para você começar</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">Sem cobrança automática, sem cartão e com entrada rápida para experimentar.</p>
                  </div>
                  <StartButton className="w-full lg:w-auto" label="Iniciar cadastro" />
                  <SecondaryButton className="w-full lg:w-auto" label="Ver planos" href="/planos" />
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[30px] border border-orange-100 bg-stone-100 shadow-2xl shadow-orange-950/10">
                <Image
                  src="/marketing/hero-saborflow.webp"
                  alt="Gestor de uma lanchonete usando o SaborFlow no notebook, com cardápio do cliente no celular"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 54vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-stone-950/5 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-5 left-4 right-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-xl backdrop-blur sm:left-8 sm:right-8">
                <div className="p-3 sm:p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Pedido</p>
                  <p className="mt-1 text-sm font-black text-stone-950">Recebido</p>
                </div>
                <div className="border-x border-stone-100 p-3 sm:p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Operação</p>
                  <p className="mt-1 text-sm font-black text-stone-950">Em preparo</p>
                </div>
                <div className="p-3 sm:p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Entrega</p>
                  <p className="mt-1 text-sm font-black text-emerald-700">No fluxo</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-orange-100 bg-white px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-7 gap-y-3 text-xs font-bold text-stone-500 sm:text-sm">
            <span className="font-black text-stone-900">Feito para:</span>
            {segments.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>

        <section id="recursos" className="scroll-mt-28 bg-[#fffdf9] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Conheça o sistema</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">O que o SaborFlow faz</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">Uma visão simples da operação para quem quer vender, produzir e entregar sem espalhar informação em vários lugares.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {overview.map(({ icon: Icon, title, text, href, tone }) => (
                <Link key={title} href={href} className="group rounded-2xl border border-stone-200 bg-white p-6 transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-950/5">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-black text-stone-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-orange-700">Entender <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="modulos" className="scroll-mt-28 border-y border-orange-100 bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Visual mais informativo</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Veja, de forma rápida, o que existe dentro do sistema</h2>
              <p className="mt-5 text-base leading-7 text-stone-600">
                Esta visão reúne os principais módulos do SaborFlow com um estilo mais amigável, mostrando IA, documentos, pedidos, delivery, clientes, equipe, relatórios, impressão e outras áreas do sistema.
              </p>
              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {moduleHighlights.map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm font-bold text-stone-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-stone-200 bg-[#fcfaf7] shadow-xl shadow-stone-950/5">
              <Image
                src="/marketing/icons-suite.webp"
                alt="Conjunto de ícones do sistema representando IA assistente, configuração, documentos, dashboard, pedidos, clientes, entrega, notificações, cardápio, impressão e suporte"
                fill
                sizes="(max-width: 1024px) 100vw, 54vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        <section id="central" className="scroll-mt-28 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] border border-stone-200 bg-stone-100 shadow-xl shadow-stone-950/5">
              <Image src="/marketing/central-controle.webp" alt="Central de controle do SaborFlow em uma operação de alimentação" fill sizes="(max-width: 1024px) 100vw, 56vw" className="object-cover" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Visão completa da rotina</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Central de Controle</h2>
              <p className="mt-5 text-base leading-7 text-stone-600">Veja o que está acontecendo na loja sem precisar procurar informação em várias telas. Pedidos, produção e atendimento ficam conectados no mesmo fluxo.</p>
              <ul className="mt-7 space-y-4">
                <CheckLine><strong>Pedidos em andamento:</strong> saiba o que chegou, o que está em preparo e o que já foi finalizado.</CheckLine>
                <CheckLine><strong>Visão da operação:</strong> acompanhe vendas e os pontos importantes da rotina em uma tela central.</CheckLine>
                <CheckLine><strong>Status mais claro:</strong> reduza desencontro entre balcão, cozinha e entrega.</CheckLine>
              </ul>
            </div>
          </div>
        </section>

        <section id="motoboys" className="scroll-mt-28 bg-orange-50/60 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Delivery mais alinhado</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Motoboys e andamento da entrega</h2>
              <p className="mt-5 text-base leading-7 text-stone-600">Organize o fluxo das entregas com mais clareza para a operação. A ideia é facilitar a visualização de quem está saindo, do pedido em rota e do que ainda precisa ser finalizado.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-orange-100 bg-white p-5"><Clock className="h-5 w-5 text-orange-600" /><p className="mt-3 text-sm font-black">Tempo de entrega</p><p className="mt-1 text-sm leading-6 text-stone-600">Mais noção do andamento dos pedidos.</p></div>
                <div className="rounded-2xl border border-orange-100 bg-white p-5"><Bike className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-sm font-black">Responsáveis</p><p className="mt-1 text-sm leading-6 text-stone-600">Acompanhe a etapa logística com mais organização.</p></div>
                <div className="rounded-2xl border border-orange-100 bg-white p-5"><MapPin className="h-5 w-5 text-sky-600" /><p className="mt-3 text-sm font-black">Status do pedido</p><p className="mt-1 text-sm leading-6 text-stone-600">A saída e a conclusão ficam mais visíveis.</p></div>
              </div>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] border border-orange-100 bg-stone-100 shadow-xl shadow-orange-950/5">
              <Image src="/marketing/motoboy-saborflow.webp" alt="Motoboy consultando o celular com painel de entregas do SaborFlow" fill sizes="(max-width: 1024px) 100vw, 56vw" className="object-cover" />
            </div>
          </div>
        </section>

        <section id="clientes" className="scroll-mt-28 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] border border-stone-200 bg-stone-100 shadow-xl shadow-stone-950/5">
              <Image src="/marketing/atendimento-saborflow.webp" alt="Atendimento com foco no cliente usando dados do SaborFlow" fill sizes="(max-width: 1024px) 100vw, 56vw" className="object-cover" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Relacionamento que ajuda a vender melhor</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Clientes, recorrência e histórico</h2>
              <p className="mt-5 text-base leading-7 text-stone-600">Conheça melhor o cliente e tenha mais contexto para atender. O histórico de pedidos e a visão de recorrência ajudam a personalizar o atendimento.</p>
              <ul className="mt-7 space-y-4">
                <CheckLine><strong>Histórico em um lugar:</strong> veja pedidos e informações do cliente sem depender da memória da equipe.</CheckLine>
                <CheckLine><strong>Relacionamento mais inteligente:</strong> identifique clientes mais frequentes e oportunidades de fidelização.</CheckLine>
                <CheckLine><strong>Atendimento com contexto:</strong> a equipe atende melhor quando enxerga o passado do cliente.</CheckLine>
              </ul>
            </div>
          </div>
        </section>

        <section id="equipe" className="scroll-mt-28 bg-stone-950 px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Todo mundo olhando para o mesmo pedido</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Funcionários e equipe no mesmo fluxo</h2>
              <p className="mt-5 text-base leading-7 text-stone-300">Atendimento, caixa, cozinha e entrega precisam enxergar a mesma informação. O SaborFlow organiza a passagem do pedido entre cada etapa.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><ClipboardList className="h-5 w-5 text-orange-400" /><p className="mt-3 font-black">Pedido conferido</p><p className="mt-1 text-sm leading-6 text-stone-400">Itens, complementos e observações juntos.</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><Printer className="h-5 w-5 text-orange-400" /><p className="mt-3 font-black">Produção organizada</p><p className="mt-1 text-sm leading-6 text-stone-400">Apoio à impressão e ao fluxo da cozinha.</p></div>
              </div>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] border border-white/10 bg-stone-900 shadow-2xl">
              <Image src="/marketing/equipe-operacao.webp" alt="Funcionária acompanhando pedidos no notebook com impressão de comanda na operação" fill sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover" />
            </div>
          </div>
        </section>

        <section id="ia" className="scroll-mt-28 bg-[#fff8ee] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-orange-100 bg-white shadow-xl shadow-orange-950/5">
            <div className="grid items-center gap-0 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="p-7 sm:p-10 lg:p-12">
                <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700"><Sparkles className="h-4 w-4" /> Recurso adicional</span>
                <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Inteligência Artificial para acelerar a configuração e a rotina</h2>
                <p className="mt-5 text-base leading-7 text-stone-600">A IA pode ajudar a montar configurações, organizar informações e apoiar tarefas do negócio. Ela é opcional e fica separada da gestão básica do teste grátis.</p>
                <div className="mt-7 grid grid-cols-2 gap-3 text-sm font-black text-stone-800">
                  {["Cardápio", "Configuração", "Atendimento", "Organização"].map((item) => <span key={item} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"><Bot className="h-4 w-4 text-violet-600" />{item}</span>)}
                </div>
              </div>
              <div className="relative min-h-[340px] lg:min-h-[470px]">
                <Image src="/marketing/ia-saborflow.webp" alt="Gestor usando recursos de inteligência artificial no SaborFlow pelo celular" fill sizes="(max-width: 1024px) 100vw, 52vw" className="object-cover" />
              </div>
            </div>
          </div>
        </section>

        <section id="migracao" className="scroll-mt-28 bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.96fr_1.04fr] lg:gap-14">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Diferencial importante</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Migrar do sistema antigo não precisa ser cansativo</h2>
              <p className="mt-5 text-base leading-7 text-stone-600">Uma das maiores dores de quem troca de sistema é perder tempo cadastrando tudo de novo. O SaborFlow pode se posicionar como a opção que simplifica essa entrada, organizando o máximo possível da operação inicial.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  "Link do cardápio ou do sistema antigo, se ainda estiver ativo.",
                  "Prints, fotos e arquivos com produtos e valores.",
                  "Ajuste de localização, entrega e estrutura da empresa.",
                  "Revisão final antes de colocar a nova loja no ar.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm font-bold text-stone-700">
                    ✓ {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[28px] border border-emerald-100 bg-emerald-50/60 p-7 shadow-xl shadow-emerald-950/5 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Como apresentar isso</p>
              <div className="mt-5 space-y-4 text-sm leading-6 text-stone-700">
                <p><strong className="text-stone-950">1. Crie a conta.</strong><br />O cliente começa com o teste grátis e usa o próprio e-mail e senha.</p>
                <p><strong className="text-stone-950">2. Traga o que já existe.</strong><br />Ele pode enviar link, prints, fotos e referências do sistema antigo.</p>
                <p><strong className="text-stone-950">3. Ajuste e publique.</strong><br />Produtos, preços, entrega e estrutura da operação ficam organizados antes da publicação.</p>
              </div>
              <Link href="/teste-gratis" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">Quero começar com 7 dias grátis <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-28 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Passo a passo</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Do pedido à entrega, tudo acontece no mesmo fluxo</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">Uma jornada simples para o cliente e uma operação mais clara para a equipe.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-4">
              {[
                { number: "01", icon: Smartphone, title: "Cliente faz o pedido", text: "Pelo cardápio digital, balcão ou atendimento." },
                { number: "02", icon: ShoppingBag, title: "Pedido entra no sistema", text: "A equipe recebe os itens e observações." },
                { number: "03", icon: ChefHat, title: "Equipe prepara", text: "Cozinha e atendimento acompanham o andamento." },
                { number: "04", icon: Bike, title: "Entrega ou retirada", text: "O pedido segue até a finalização com mais controle." },
              ].map(({ number, icon: Icon, title, text }, index) => (
                <div key={title} className="relative rounded-2xl border border-stone-200 bg-white p-6">
                  <div className="flex items-center justify-between"><span className="text-xs font-black text-orange-600">{number}</span><Icon className="h-5 w-5 text-stone-400" /></div>
                  <h3 className="mt-6 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
                  {index < 3 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 rounded-full bg-[#fffaf3] p-1 text-orange-500 md:block" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-orange-100 bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Escolha guiada</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Dê prioridade ao teste grátis de 7 dias</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">A melhor forma de começar é criar seu acesso e testar a gestão simples primeiro. Assim a pessoa entende o sistema antes de comparar planos e recursos adicionais.</p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[30px] border-2 border-orange-300 bg-orange-50 p-7 shadow-lg shadow-orange-950/5">
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black text-orange-700"><ShieldCheck className="h-4 w-4" /> Recomendado para começar</p>
                <h3 className="mt-4 text-3xl font-black tracking-tight text-stone-950">Teste grátis por 7 dias</h3>
                <p className="mt-3 text-base leading-7 text-stone-600">A pessoa cria o acesso, entra no sistema e conhece a base da operação sem cartão e sem cobrança automática.</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {[
                    "7 dias liberados",
                    "Sem cartão",
                    "Sem cobrança automática",
                    "Gestão simples incluída",
                  ].map((item) => (
                    <span key={item} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-stone-700 shadow-sm">
                      <Check className="h-4 w-4 text-orange-600" />
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">Iniciar agora</p>
                    <p className="mt-2 text-base font-black text-stone-950">Criar acesso e começar a testar</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">Entrada pensada para levar a pessoa direto ao cadastro.</p>
                  </div>
                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">Depois comparar</p>
                    <p className="mt-2 text-base font-black text-stone-950">Conheça o sistema antes de escolher o plano</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">Uma jornada comercial mais clara e menos confusa.</p>
                  </div>
                </div>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <StartButton className="sm:min-w-52" label="Quero iniciar meu cadastro" />
                  <SecondaryButton className="sm:min-w-44" label="Falar com a equipe" href="/planos" />
                </div>
              </div>
              <div className="rounded-[30px] bg-stone-950 p-7 text-white sm:p-9">
                <Store className="h-8 w-8 text-orange-400" />
                <h3 className="mt-5 text-2xl font-black">Feito para a rotina real da loja</h3>
                <div className="mt-6 space-y-4 text-sm leading-6 text-stone-300">
                  <p><strong className="text-white">1. Organize o cardápio.</strong><br />Categorias, produtos, sabores e complementos.</p>
                  <p><strong className="text-white">2. Receba e acompanhe pedidos.</strong><br />Da entrada à cozinha, retirada ou entrega.</p>
                  <p><strong className="text-white">3. Cresça quando precisar.</strong><br />Ative recursos adicionais conforme sua operação evoluir.</p>
                </div>
                <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-stone-300">
                  <p className="font-black text-white">Fluxo sugerido</p>
                  <p className="mt-2">Primeiro a pessoa testa por 7 dias grátis. Depois ela escolhe o plano e decide se quer adicionar IA ou outros recursos.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-stone-950 px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-14 lg:py-14">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">SaborFlow</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">Coloque sua operação no fluxo certo.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300">Veja a demonstração ou comece o teste grátis para entender como o sistema se encaixa na sua rotina.</p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:ml-8">
              <StartButton label="Começar 7 dias grátis" />
              <Link href="/planos" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-black text-white transition hover:bg-white/15">Ver planos <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:pb-20">
          <h2 className="text-center text-3xl font-black">Perguntas rápidas</h2>
          <div className="mt-8 divide-y divide-stone-200">
            {[
              ["O SaborFlow serve apenas para lanchonetes?", "Não. A proposta atende diferentes negócios de alimentação, como salgaderias, restaurantes, hamburguerias, pizzarias, açaí, confeitarias e operações de delivery."],
              ["Preciso usar inteligência artificial?", "Não. A gestão básica funciona sem IA. Os recursos de inteligência artificial são adicionais e podem ser ativados conforme a necessidade do negócio."],
              ["O teste grátis precisa de cartão?", "Não. O teste dura 7 dias e não gera cobrança automática. Depois, você pode comparar os planos disponíveis."],
              ["O cliente consegue fazer o pedido pelo celular?", "Sim. A proposta do fluxo é conectar o cardápio do cliente à operação da loja, facilitando a entrada e o acompanhamento dos pedidos."],
            ].map(([question, answer]) => (
              <details key={question} className="py-5">
                <summary className="cursor-pointer font-black text-stone-900">{question}</summary>
                <p className="mt-3 text-sm leading-7 text-stone-600">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
