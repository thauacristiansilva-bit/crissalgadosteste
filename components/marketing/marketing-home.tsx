import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import {
  ArrowRight,
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

function CheckLine({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-6 text-stone-700">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white">
        <Check aria-hidden="true" className="h-3 w-3" />
      </span>
      <span>{children}</span>
    </li>
  )
}

export function MarketingHome() {
  return (
    <MarketingShell>
      <main>
        <section className="overflow-hidden border-b border-orange-100 bg-[#fffaf3]">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[0.94fr_1.06fr] lg:gap-14 lg:px-8 lg:pb-16 lg:pt-16">
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-black text-orange-800 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-orange-600" />
                Gestão para negócios de alimentação
              </span>
              <h1 className="mt-6 text-4xl font-black leading-[1.03] tracking-[-0.045em] text-stone-950 sm:text-5xl xl:text-6xl">
                Seu negócio organizado.
                <span className="mt-1 block text-orange-600">Seus pedidos no controle.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
                Gerencie cardápio, pedidos, clientes, equipe, delivery e operação em um só lugar. O SaborFlow foi criado para deixar a rotina mais simples do pedido à entrega.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <StartButton className="sm:min-w-40" />
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-6 py-3.5 text-sm font-black text-stone-800 transition hover:border-orange-300 hover:bg-orange-50"
                >
                  Ver demonstração
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-stone-500 sm:text-sm">
                {["7 dias grátis", "Sem cartão", "Gestão simples incluída", "IA opcional"].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <Check aria-hidden="true" className="h-4 w-4 text-orange-600" />
                    {item}
                  </span>
                ))}
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
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14">
            <div className="order-2 lg:order-1">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Delivery mais organizado</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Motoboys e entregas no mesmo fluxo</h2>
              <p className="mt-5 text-base leading-7 text-stone-600">Organize os pedidos que saem para entrega, identifique quem está responsável e deixe a equipe sabendo em qual etapa cada pedido se encontra.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-orange-100 bg-white p-5"><Bike className="h-5 w-5 text-emerald-700" /><p className="mt-3 font-black">Responsável pela entrega</p><p className="mt-1 text-sm leading-6 text-stone-600">Associe a saída ao fluxo do delivery.</p></div>
                <div className="rounded-2xl border border-orange-100 bg-white p-5"><Clock className="h-5 w-5 text-orange-700" /><p className="mt-3 font-black">Status do pedido</p><p className="mt-1 text-sm leading-6 text-stone-600">Acompanhe preparação, saída e conclusão.</p></div>
              </div>
            </div>
            <div className="order-1 relative aspect-[16/10] overflow-hidden rounded-[28px] border border-orange-100 bg-stone-100 shadow-xl shadow-orange-950/5 lg:order-2">
              <Image src="/marketing/motoboy-saborflow.webp" alt="Motoboy conferindo uma entrega pelo celular em frente a um restaurante" fill sizes="(max-width: 1024px) 100vw, 56vw" className="object-cover" />
              <div className="absolute bottom-4 left-4 rounded-2xl border border-white/70 bg-white/95 p-4 shadow-lg backdrop-blur sm:bottom-6 sm:left-6">
                <span className="flex items-center gap-2 text-xs font-black text-emerald-700"><MapPin className="h-4 w-4" /> Pedido pronto para sair</span>
                <p className="mt-1 text-xs text-stone-500">A operação sabe quem está com a entrega.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="clientes" className="scroll-mt-28 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] border border-stone-200 bg-stone-100 shadow-xl shadow-stone-950/5">
              <Image src="/marketing/operacao-integrada.webp" alt="Gestor acompanhando informações de pedidos, clientes, motoboys e equipe" fill sizes="(max-width: 1024px) 100vw, 56vw" className="object-cover" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Relacionamento que continua depois da venda</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Conheça melhor seus clientes</h2>
              <p className="mt-5 text-base leading-7 text-stone-600">O cliente deixa de ser apenas “mais um pedido”. O histórico ajuda a entender recorrência, preferências e o relacionamento com a sua loja.</p>
              <ul className="mt-7 space-y-4">
                <CheckLine><strong>Histórico de pedidos:</strong> consulte compras anteriores e informações úteis para o atendimento.</CheckLine>
                <CheckLine><strong>Clientes recorrentes:</strong> reconheça quem volta a comprar e fortaleça a fidelização.</CheckLine>
                <CheckLine><strong>Cashback e relacionamento:</strong> conecte sua estratégia de fidelidade à rotina da loja quando configurado.</CheckLine>
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
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-14">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Comece pelo necessário</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Teste a gestão simples antes de contratar</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">Você pode experimentar a base do sistema sem configurar IA. Conheça produtos, pedidos, PDV, cozinha, clientes e caixa antes de escolher o plano ideal.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                {["7 dias", "Sem cartão", "Sem cobrança automática", "IA não obrigatória"].map((item) => <span key={item} className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-xs font-black text-stone-700"><ShieldCheck className="h-4 w-4 text-emerald-600" />{item}</span>)}
              </div>
              <StartButton className="mt-8" label="Começar meu teste grátis" />
            </div>
            <div className="rounded-[28px] bg-stone-950 p-7 text-white sm:p-9">
              <Store className="h-8 w-8 text-orange-400" />
              <h3 className="mt-5 text-2xl font-black">Feito para a rotina real da loja</h3>
              <div className="mt-6 space-y-4 text-sm leading-6 text-stone-300">
                <p><strong className="text-white">1. Organize o cardápio.</strong><br />Categorias, produtos, sabores e complementos.</p>
                <p><strong className="text-white">2. Receba e acompanhe pedidos.</strong><br />Da entrada à cozinha, retirada ou entrega.</p>
                <p><strong className="text-white">3. Cresça quando precisar.</strong><br />Ative recursos adicionais conforme sua operação evoluir.</p>
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
              <StartButton />
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
