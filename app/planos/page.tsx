import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Bot,
  Check,
  CreditCard,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
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
    caption: "Flexibilidade máxima",
    description: "Use mês a mês, sem permanência mínima contratual.",
    commitment: "Sem fidelidade",
    highlight: false,
  },
  {
    cycle: "semiannual",
    name: "Semestral",
    headline: money(SEMIANNUAL_TOTAL_CENTS / 6),
    suffix: "/mês",
    total: money(SEMIANNUAL_TOTAL_CENTS),
    caption: "Economize 10%",
    description: "6 meses de contrato com valor mensal reduzido.",
    commitment: "Permanência mínima de 6 meses",
    highlight: false,
  },
  {
    cycle: "annual",
    name: "Anual",
    headline: money(ANNUAL_TOTAL_CENTS / 12),
    suffix: "/mês",
    total: money(ANNUAL_TOTAL_CENTS),
    caption: "Melhor custo-benefício · economize 20%",
    description: "12 meses de contrato com o menor valor mensal.",
    commitment: "Permanência mínima de 12 meses",
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
                  <p className="mt-5 min-h-12 text-sm leading-6 text-stone-600">{option.description}</p>
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
