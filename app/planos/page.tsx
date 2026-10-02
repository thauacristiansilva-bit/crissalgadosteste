import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Bot, Check, CreditCard, QrCode, ReceiptText, ShieldCheck, Sparkles } from "lucide-react"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { listCommercialPlans } from "@/lib/billing-contracting"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Planos — SaborFlow",
  description: "Conheça os planos comerciais do SaborFlow, o teste grátis por 7 dias e o adicional de IA.",
}

function money(cents: number | null, currency: string) {
  if (cents == null) return null
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100)
}

function limit(value: number | null) {
  return value === null ? "Ilimitado" : String(value)
}

function planHighlights(plan: Awaited<ReturnType<typeof listCommercialPlans>>[number]) {
  return [
    `${limit(plan.entitlements.maxOrganizations)} loja(s)`,
    `${limit(plan.entitlements.maxUsers)} acesso(s)`,
    `${limit(plan.entitlements.maxProducts)} produto(s)`,
    plan.entitlements.delivery ? "Delivery e retirada" : "Operação organizada",
    plan.entitlements.kitchen ? "Fluxo de cozinha" : "Gestão simples",
    plan.entitlements.financial ? "Financeiro e caixa" : "Cadastro e pedidos",
    plan.entitlements.loyalty ? "Clientes e fidelidade" : "Clientes e histórico",
    plan.entitlements.integrations ? "Integrações liberadas" : "Pronto para crescer",
  ].slice(0, 5)
}

export default async function PlansPage() {
  const plans = await listCommercialPlans().catch(() => [])

  return (
    <MarketingShell>
      <main className="px-4 pb-20 pt-12 sm:px-6 lg:px-8 lg:pt-20">
        <div className="mx-auto max-w-7xl">
          <section className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-black text-orange-800 shadow-sm">
                <ShieldCheck className="h-4 w-4" />
                Teste grátis por 7 dias antes da contratação
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] text-stone-950 sm:text-5xl lg:text-6xl">
                Planos claros para vender, organizar e crescer.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
                O SaborFlow foi pensado para ser simples de contratar e fácil de entender. Primeiro a pessoa testa por 7 dias. Depois, escolhe o plano ideal para continuar com a mesma loja, os mesmos produtos e a mesma conta.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  "7 dias grátis, sem cartão e sem cobrança automática",
                  "A mesma conta continua depois do teste",
                  "Pix, cartão e boleto para facilitar a contratação",
                  "IA como adicional opcional, sem obrigar o cliente",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-stone-200 bg-white px-4 py-4 text-sm font-bold text-stone-700 shadow-sm">
                    <span className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/teste-gratis" className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3.5 text-sm font-black text-white hover:bg-orange-700">
                  Começar 7 dias grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-6 py-3.5 text-sm font-black text-stone-800 hover:border-orange-300 hover:bg-orange-50">
                  Ver demonstração
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-[32px] border-2 border-orange-200 bg-white p-7 shadow-xl shadow-orange-950/5 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Destaque comercial</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950">Comece pelo teste grátis e continue sem perder nada</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">
                Se a pessoa contratar durante os 7 dias, o sistema continua na mesma conta. Os dias grátis restantes são preservados e o plano pago entra logo depois, sem criar outra empresa e sem recadastrar tudo.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-orange-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">Durante o teste</p>
                  <p className="mt-2 text-base font-black text-stone-950">A pessoa entra com o próprio e-mail e senha</p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">Nada de conta demo solta. O acesso já é da própria empresa.</p>
                </div>
                <div className="rounded-2xl bg-stone-100 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-600">Depois da contratação</p>
                  <p className="mt-2 text-base font-black text-stone-950">A mesma loja continua ativa</p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">Produtos, clientes, pedidos e configurações permanecem na conta.</p>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-dashed border-orange-300 bg-[#fffaf3] p-5 text-sm leading-6 text-stone-600">
                <p className="font-black text-stone-950">Fluxo sugerido</p>
                <p className="mt-2">1. Testa por 7 dias → 2. Escolhe mensal ou anual → 3. Se quiser, adiciona a IA para acelerar configuração e ajustes.</p>
              </div>
            </div>
          </section>

          <section className="mt-16 rounded-[32px] border border-orange-100 bg-white p-7 shadow-sm sm:p-10">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">O que está incluso</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">O cliente entende rápido o que ganha no SaborFlow</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">Em vez de esconder recurso importante, o SaborFlow mostra o valor da plataforma de forma clara. A ideia é destacar o benefício real para a empresa.</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Cardápio e pedidos", "Categorias, produtos, complementos, pedidos, PDV e operação."],
                ["Equipe e produção", "Fluxo entre atendimento, cozinha, caixa e entrega."],
                ["Clientes e vendas", "Histórico, relacionamento, promoções, fidelidade e relatórios."],
                ["Pagamento e continuidade", "Teste grátis, contratação simples e renovação organizada."],
              ].map(([title, text]) => (
                <article key={title} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                  <h3 className="text-lg font-black text-stone-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Opções de contratação</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Escolha a forma de continuar depois do teste</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">Os valores abaixo vêm da configuração comercial ativa do SaborFlow. Se ainda estiverem sendo preparados, a pessoa pode começar pelo teste grátis e concluir a contratação depois.</p>
            </div>

            {plans.length === 0 ? (
              <div className="mt-8 rounded-[28px] border border-orange-200 bg-white p-8 sm:p-10">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Em preparação</p>
                <h3 className="mt-3 text-2xl font-black text-stone-950">Os preços públicos ainda estão sendo ajustados.</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">Enquanto isso, a pessoa pode começar o teste por 7 dias, conhecer a estrutura e depois seguir para a contratação com mais segurança.</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link href="/teste-gratis" className="rounded-xl bg-orange-600 px-5 py-3 text-center text-sm font-black text-white">Começar teste grátis</Link>
                  <Link href="/demo" className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-center text-sm font-black text-stone-800">Ver demonstração</Link>
                </div>
              </div>
            ) : (
              <div className="mt-8 grid gap-5 lg:grid-cols-3">
                {plans.map((plan) => {
                  const monthly = money(plan.monthlyPriceCents, plan.currency)
                  const annual = money(plan.annualPriceCents, plan.currency)
                  return (
                    <article key={plan.id} className="flex h-full flex-col rounded-[28px] border border-orange-100 bg-white p-7 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">{plan.code}</p>
                          <h3 className="mt-2 text-2xl font-black text-stone-950">{plan.name}</h3>
                        </div>
                        <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.15em] text-orange-700">7 dias grátis antes</span>
                      </div>
                      <p className="mt-3 min-h-12 text-sm leading-6 text-stone-600">{plan.description}</p>
                      <div className="mt-6">
                        {monthly && <><p className="text-3xl font-black text-stone-950">{monthly}</p><p className="text-xs font-bold text-stone-400">por mês</p></>}
                        {annual && <p className="mt-2 text-xs font-bold text-stone-500">Anual: {annual}</p>}
                      </div>
                      <div className="mt-6 space-y-2 text-sm font-bold text-stone-700">
                        {planHighlights(plan).map((item) => (
                          <p key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</p>
                        ))}
                      </div>
                      <Link href={`/contratar?plano=${encodeURIComponent(plan.code)}`} className="mt-7 rounded-xl bg-stone-950 px-5 py-3 text-center text-sm font-black text-white">
                        Escolher {plan.name}
                      </Link>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="mt-16 grid gap-6 lg:grid-cols-[1.06fr_0.94fr]">
            <div className="rounded-[32px] border border-violet-100 bg-white p-7 shadow-sm sm:p-10">
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700">
                <Sparkles className="h-4 w-4" />
                Adicional opcional
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-stone-950">SaborFlow IA para montar e ajustar a empresa mais rápido</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">A IA não precisa ficar dentro do preço principal. Ela pode ser ativada como adicional para economizar tempo na montagem da empresa, no cardápio e nos ajustes do sistema.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  "Importar cardápio por fotos e prints",
                  "Organizar categorias, produtos e complementos",
                  "Sugerir descrições, estrutura e ajustes visuais",
                  "Receber novas instruções até chegar no resultado final",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm font-bold text-stone-700">
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-6 text-stone-500">Você pode configurar limites de uso, quantidade de ações e prazo de ativação sem misturar esse custo com o plano base.</p>
            </div>

            <div className="rounded-[32px] border border-emerald-100 bg-white p-7 shadow-sm sm:p-10">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Migração sem dor de cabeça</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950">Trazer o cadastro antigo precisa ser simples</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">O diferencial pode ser deixar claro que o cliente não precisa perder uma semana cadastrando item por item de novo.</p>
              <div className="mt-7 space-y-3">
                {[
                  "Cole o link do sistema antigo ou do cardápio que ainda estiver ativo.",
                  "Se preferir, anexe prints, fotos e documentos com produtos e valores.",
                  "Organize localização, entrega, preços e detalhes da operação com apoio do sistema.",
                  "Revise tudo antes de publicar, sem precisar começar do zero.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm font-bold text-stone-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-16 rounded-[32px] border border-orange-100 bg-white p-7 shadow-sm sm:p-10">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Pagamento simplificado</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Mostre logo as formas de pagamento e passe segurança</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">Para a página comercial, vale destacar que o cliente pode contratar e renovar de forma prática, escolhendo o formato que preferir.</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                { icon: QrCode, title: "Pix", text: "Pagamento rápido, simples e familiar para boa parte dos clientes." },
                { icon: CreditCard, title: "Cartão", text: "Cobrança organizada para mensal ou anual." },
                { icon: ReceiptText, title: "Boleto", text: "Outra alternativa para quem prefere seguir com cobrança tradicional." },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                  <Icon className="h-6 w-6 text-orange-600" />
                  <h3 className="mt-4 text-lg font-black text-stone-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </MarketingShell>
  )
}
