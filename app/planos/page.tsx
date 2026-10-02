import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  Clock3,
  CreditCard,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  TriangleAlert,
  Users,
  WalletCards,
} from "lucide-react"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import {
  ANNUAL_TOTAL_CENTS,
  EARLY_TERMINATION_PENALTY_PERCENT,
  MONTHLY_TOTAL_CENTS,
  SEMIANNUAL_TOTAL_CENTS,
} from "@/lib/commercial-contract"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Planos — SaborFlow",
  description: "SaborFlow Completo com contratação mensal, semestral ou anual e 7 dias grátis.",
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

const semiannualReferenceCents = MONTHLY_TOTAL_CENTS * 6
const annualReferenceCents = MONTHLY_TOTAL_CENTS * 12
const semiannualSavingsCents = semiannualReferenceCents - SEMIANNUAL_TOTAL_CENTS
const annualSavingsCents = annualReferenceCents - ANNUAL_TOTAL_CENTS

const coreFeatures = [
  "Cardápio digital e página da loja",
  "Produtos, categorias e complementos",
  "Pedidos, PDV e cozinha",
  "Clientes, histórico e fidelidade",
  "Delivery, retirada e motoboys",
  "Funcionários e permissões",
  "Caixa, financeiro e relatórios",
  "Promoções, cupons e integrações disponíveis",
  "Impressão e fluxo operacional",
  "Atualizações do SaborFlow",
]

const options = [
  {
    cycle: "monthly",
    name: "Mensal",
    headline: money(MONTHLY_TOTAL_CENTS),
    suffix: "/mês",
    total: money(MONTHLY_TOTAL_CENTS),
    caption: "Mais liberdade",
    description: "Para quem prefere pagar mês a mês e manter flexibilidade total, sem permanência mínima.",
    commitment: "Sem fidelidade",
    savings: "Sem compromisso de longo prazo",
    highlight: false,
  },
  {
    cycle: "semiannual",
    name: "Semestral",
    headline: money(SEMIANNUAL_TOTAL_CENTS / 6),
    suffix: "/mês",
    total: money(SEMIANNUAL_TOTAL_CENTS),
    caption: "Equilíbrio entre preço e compromisso",
    description: "Para quem já quer organizar a operação por mais tempo e reduzir o custo mensal sem fechar um ano inteiro.",
    commitment: "Permanência mínima de 6 meses",
    savings: `Economia de ${money(semiannualSavingsCents)} no período`,
    highlight: false,
  },
  {
    cycle: "annual",
    name: "Anual",
    headline: money(ANNUAL_TOTAL_CENTS / 12),
    suffix: "/mês",
    total: money(ANNUAL_TOTAL_CENTS),
    caption: "Maior economia",
    description: "Para quem quer usar o SaborFlow como sistema principal da empresa e pagar o menor valor mensal do contrato.",
    commitment: "Permanência mínima de 12 meses",
    savings: `Economia de ${money(annualSavingsCents)} no ano`,
    highlight: true,
  },
] as const

export default function PlansPage() {
  return (
    <MarketingShell>
      <main>
        <section className="border-b border-orange-100 bg-[#fffaf3] px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pb-20 lg:pt-20">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-black text-orange-800 shadow-sm">
                <ShieldCheck className="h-4 w-4" />
                7 dias grátis antes da cobrança
              </span>
              <h1 className="mt-6 text-4xl font-black tracking-[-0.045em] text-stone-950 sm:text-5xl lg:text-6xl">
                Um SaborFlow completo. <span className="text-orange-600">Você escolhe só por quanto tempo.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
                O núcleo do sistema é o mesmo. A diferença entre mensal, semestral e anual está no preço, no período de permanência e na economia do contrato.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {options.map((option) => (
                <article
                  key={option.cycle}
                  className={`relative flex h-full flex-col rounded-[30px] bg-white p-7 shadow-sm ${option.highlight ? "border-2 border-orange-500 shadow-xl shadow-orange-950/10" : "border border-stone-200"}`}
                >
                  {option.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-600 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white">
                      Mais vantajoso
                    </span>
                  )}
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">{option.caption}</p>
                  <h2 className="mt-3 text-2xl font-black text-stone-950">{option.name}</h2>
                  <p className="mt-4 text-4xl font-black tracking-tight text-stone-950">{option.headline}<span className="text-sm font-bold text-stone-400">{option.suffix}</span></p>
                  <p className="mt-2 text-xs font-bold text-stone-500">Valor contratual: {option.total}</p>
                  <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">{option.savings}</p>
                  <p className="mt-5 min-h-16 text-sm leading-6 text-stone-600">{option.description}</p>
                  <div className="mt-5 rounded-2xl bg-stone-50 p-4 text-sm font-bold text-stone-700">
                    <Check className="mr-2 inline h-4 w-4 text-emerald-600" />
                    {option.commitment}
                  </div>
                  {option.cycle !== "monthly" && (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
                      <strong>Cancelamento antecipado:</strong> multa de {EARLY_TERMINATION_PENALTY_PERCENT}% sobre o saldo das mensalidades vincendas, observados os limites legais e as hipóteses de isenção previstas em lei.
                    </div>
                  )}
                  <Link
                    href={`/contratar?plano=completo&ciclo=${option.cycle}`}
                    className={`mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black ${option.highlight ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-stone-950 text-white hover:bg-black"}`}
                  >
                    Escolher {option.name.toLowerCase()}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-orange-200 bg-white px-5 py-4 text-center text-sm leading-6 text-stone-600">
              <strong className="text-stone-950">Contratou antes do fim do teste?</strong> Os dias grátis restantes continuam valendo. O período pago é programado para começar depois do 7º dia.
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Por que estes valores?</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Você não está pagando apenas por uma tela de pedidos. Está organizando a operação inteira.</h2>
              <p className="mt-5 text-base leading-7 text-stone-600">O valor do SaborFlow reúne as áreas que normalmente ficam espalhadas em ferramentas diferentes: cardápio, pedidos, produção, clientes, equipe, delivery, caixa e gestão. O objetivo é reduzir retrabalho e dar uma visão mais clara do negócio.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Clock3, title: "Menos tempo operacional", text: "Menos troca de telas, anotações e conferências manuais durante o dia." },
                  { icon: BarChart3, title: "Mais visão da empresa", text: "Pedidos, vendas e andamento da operação ficam mais fáceis de acompanhar." },
                  { icon: Users, title: "Equipe mais alinhada", text: "Atendimento, cozinha, caixa e entrega passam a seguir o mesmo fluxo." },
                  { icon: WalletCards, title: "Escolha o nível de economia", text: "O sistema é o mesmo; o que muda é o período contratado e o desconto." },
                ].map(({ icon: Icon, title, text }) => (
                  <article key={title} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                    <Icon className="h-5 w-5 text-orange-600" />
                    <h3 className="mt-3 font-black text-stone-950">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="relative aspect-[16/11] overflow-hidden rounded-[30px] border border-orange-100 bg-stone-100 shadow-2xl shadow-orange-950/10">
              <Image
                src="/marketing/operacao-integrada.webp"
                alt="Operação de alimentação organizada com atendimento, pedidos e gestão integrados"
                fill
                sizes="(max-width: 1024px) 100vw, 48vw"
                className="object-cover"
              />
              <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/60 bg-white/95 p-4 shadow-xl backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">O diferencial</p>
                <p className="mt-1 text-base font-black text-stone-950">Uma operação mais organizada em vez de várias ferramentas desconectadas.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#fffaf3] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Entenda a diferença</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">O sistema é completo nos três períodos. A diferença é quanto você economiza.</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">O mensal prioriza liberdade. O semestral reduz o custo com um compromisso intermediário. O anual entrega a maior economia para quem já decidiu usar o SaborFlow no dia a dia.</p>
            </div>
            <div className="mt-10 overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
              <div className="grid grid-cols-[1.35fr_repeat(3,1fr)] border-b border-stone-200 bg-stone-50 text-sm font-black text-stone-900">
                <div className="p-4 sm:p-5">Comparação</div>
                <div className="p-4 text-center sm:p-5">Mensal</div>
                <div className="p-4 text-center sm:p-5">Semestral</div>
                <div className="bg-orange-50 p-4 text-center text-orange-800 sm:p-5">Anual</div>
              </div>
              {[
                ["Valor por mês", money(MONTHLY_TOTAL_CENTS), money(SEMIANNUAL_TOTAL_CENTS / 6), money(ANNUAL_TOTAL_CENTS / 12)],
                ["Economia no período", "—", money(semiannualSavingsCents), money(annualSavingsCents)],
                ["Permanência mínima", "Não", "6 meses", "12 meses"],
                ["Recursos do SaborFlow", "Completo", "Completo", "Completo"],
                ["7 dias grátis antes", "Sim", "Sim", "Sim"],
              ].map(([label, monthly, semi, annual]) => (
                <div key={label} className="grid grid-cols-[1.35fr_repeat(3,1fr)] border-b border-stone-100 text-sm last:border-b-0">
                  <div className="p-4 font-bold text-stone-700 sm:p-5">{label}</div>
                  <div className="p-4 text-center text-stone-600 sm:p-5">{monthly}</div>
                  <div className="p-4 text-center text-stone-600 sm:p-5">{semi}</div>
                  <div className="bg-orange-50/50 p-4 text-center font-bold text-stone-800 sm:p-5">{annual}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-stone-500">A economia é calculada comparando o valor do período com a contratação mensal de R$ 99,90 durante o mesmo número de meses.</p>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">SaborFlow Completo</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">O cliente não precisa descobrir depois que a função importante ficou bloqueada.</h2>
              <p className="mt-5 text-base leading-7 text-stone-600">A proposta comercial é simples: o plano principal entrega a operação completa. Recursos com custo variável, como a configuração avançada com IA, ficam como adicionais opcionais.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {coreFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm font-bold text-stone-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#fff8ee] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[32px] border border-violet-100 bg-white p-7 shadow-sm sm:p-10">
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700"><Sparkles className="h-4 w-4" /> Adicional opcional</span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-stone-950">SaborFlow IA</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">A IA pode ser contratada separadamente para acelerar a implantação e as alterações da empresa: interpretar cardápios, organizar produtos, sugerir estrutura, analisar fotos e ajudar a chegar mais rápido ao resultado final.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  "Análise de cardápio antigo e imagens",
                  "Organização de categorias e produtos",
                  "Complementos, descrições e estrutura",
                  "Prévia e revisões antes de publicar",
                ].map((item) => <div key={item} className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm font-bold text-stone-700"><Bot className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />{item}</div>)}
              </div>
              <p className="mt-6 text-sm leading-6 text-stone-500">O valor e a franquia de uso da IA podem ser administrados separadamente do plano principal, evitando repassar esse custo para quem não precisa do recurso.</p>
            </div>

            <div className="rounded-[32px] border border-orange-100 bg-white p-7 shadow-sm sm:p-10">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Antes de contratar</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950">Contrato e regras visíveis, sem surpresa</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">No checkout, o cliente vê o valor, o ciclo escolhido, o período de permanência, a forma de pagamento e a regra de cancelamento antes de marcar o aceite obrigatório.</p>
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
                <div className="flex items-start gap-3">
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <p><strong>Semestral e anual:</strong> a cláusula de rescisão antecipada prevê multa de {EARLY_TERMINATION_PENALTY_PERCENT}% sobre o saldo ainda vincendo, sempre sujeita à legislação aplicável e à análise de eventual hipótese de isenção.</p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/contrato-assinatura" className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-black text-stone-800">Ler contrato de assinatura</Link>
                <Link href="/termos" className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-black text-stone-800">Termos de Uso</Link>
                <Link href="/privacidade" className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-black text-stone-800">Privacidade</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-stone-950 px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">O que muda na rotina</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Mais organização para a empresa crescer sem depender de improviso.</h2>
                <p className="mt-5 text-base leading-7 text-stone-300">O SaborFlow foi desenhado para reduzir a parte chata da operação: informação espalhada, pedido perdido, equipe perguntando o mesmo status e cadastro difícil de manter.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Store, title: "Tudo em um só lugar", text: "Cardápio, pedidos, equipe, clientes e operação conectados." },
                  { icon: Clock3, title: "Menos retrabalho", text: "Menos tempo repetindo cadastro, conferência e acompanhamento manual." },
                  { icon: BarChart3, title: "Decisões mais claras", text: "Uma visão central ajuda a entender o que está acontecendo na loja." },
                  { icon: Sparkles, title: "IA quando fizer sentido", text: "Quem quiser acelerar configurações e mudanças pode contratar a IA à parte." },
                ].map(({ icon: Icon, title, text }) => (
                  <article key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <Icon className="h-5 w-5 text-orange-400" />
                    <h3 className="mt-3 font-black text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-400">{text}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="mt-10 flex flex-col items-center justify-between gap-5 rounded-[26px] border border-white/10 bg-white/5 p-6 sm:flex-row sm:p-8">
              <div>
                <p className="text-xl font-black">Você não precisa decidir só pelo preço.</p>
                <p className="mt-2 text-sm leading-6 text-stone-300">Comece pelos 7 dias grátis e veja se o SaborFlow realmente encaixa na sua operação antes do contrato pago começar.</p>
              </div>
              <Link href="/teste-gratis" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-black text-white hover:bg-orange-600">Testar antes de contratar <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Formas de pagamento</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Escolha como pagar</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">A estrutura de integração está preparada para oferecer Pix, cartão e boleto quando a API de pagamentos for ativada.</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                { icon: QrCode, title: "Pix", text: "Pagamento simples e rápido, com confirmação pelo provedor." },
                { icon: CreditCard, title: "Cartão", text: "Ideal para recorrência e continuidade automática da assinatura." },
                { icon: ReceiptText, title: "Boleto", text: "Alternativa para empresas que preferem cobrança tradicional." },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-2xl border border-stone-200 bg-stone-50 p-6">
                  <Icon className="h-6 w-6 text-orange-600" />
                  <h3 className="mt-4 text-lg font-black text-stone-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
                </article>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/teste-gratis" className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3.5 text-sm font-black text-white hover:bg-orange-700">Começar 7 dias grátis <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
