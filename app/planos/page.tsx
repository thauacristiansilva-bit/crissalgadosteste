import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { listCommercialPlans } from "@/lib/billing-contracting"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Planos — SaborFlow", description: "Conheça os planos comerciais do SaborFlow." }

function money(cents: number | null, currency: string) {
  if (cents == null) return null
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100)
}

function limit(value: number | null) { return value === null ? "Ilimitado" : String(value) }

export default async function PlansPage() {
  const plans = await listCommercialPlans().catch(() => [])
  return (
    <MarketingShell><main className="px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-24">
      <div className="mx-auto max-w-7xl"><div className="max-w-4xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Planos</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-stone-950 sm:text-6xl">Limites claros para cada estágio da operação.</h1><p className="mt-5 max-w-3xl text-base leading-7 text-stone-600 sm:text-lg">Lojas, usuários, produtos e recursos são controlados pelo plano no backend. Os valores abaixo vêm da configuração comercial ativa do SaborFlow.</p></div>
        {plans.length === 0 ? (
          <div className="mt-10 rounded-[28px] border border-orange-200 bg-white p-8 sm:p-10"><p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Em preparação</p><h2 className="mt-3 text-2xl font-black text-stone-950">Os planos públicos ainda não foram publicados.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">A estrutura comercial já está pronta, mas preços e limites públicos precisam ser definidos antes da abertura oficial das vendas.</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link href="/demo" className="rounded-xl bg-orange-600 px-5 py-3 text-center text-sm font-black text-white">Testar demonstração</Link><Link href="/contratar" className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-center text-sm font-black text-stone-800">Área de contratação</Link></div></div>
        ) : (
          <div className="mt-10 grid gap-5 lg:grid-cols-3">{plans.map((plan) => {
            const monthly = money(plan.monthlyPriceCents, plan.currency)
            const annual = money(plan.annualPriceCents, plan.currency)
            return <article key={plan.id} className="flex flex-col rounded-[28px] border border-orange-100 bg-white p-7 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">{plan.code}</p><h2 className="mt-2 text-2xl font-black text-stone-950">{plan.name}</h2><p className="mt-3 min-h-12 text-sm leading-6 text-stone-600">{plan.description}</p><div className="mt-6">{monthly && <><p className="text-3xl font-black text-stone-950">{monthly}</p><p className="text-xs font-bold text-stone-400">por mês</p></>}{annual && <p className="mt-2 text-xs font-bold text-stone-500">Anual: {annual}</p>}</div><div className="mt-6 space-y-2 text-sm font-bold text-stone-700"><p className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" />{limit(plan.entitlements.maxOrganizations)} loja(s)</p><p className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" />{limit(plan.entitlements.maxUsers)} usuário(s)</p><p className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" />{limit(plan.entitlements.maxProducts)} produto(s)</p></div><Link href={`/contratar?plano=${encodeURIComponent(plan.code)}`} className="mt-7 rounded-xl bg-stone-950 px-5 py-3 text-center text-sm font-black text-white">Começar com {plan.name}</Link></article>
          })}</div>
        )}
      </div>
    </main></MarketingShell>
  )
}
