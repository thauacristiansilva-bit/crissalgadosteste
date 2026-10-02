"use client"

import { useEffect, useMemo, useState } from "react"
import { Building2, Check, CreditCard, LoaderCircle, Package, ShieldCheck, Users, X } from "lucide-react"
import type { BillingCycle, BillingSnapshot, CommercialBillingStatus, CommercialPlan, PlanEntitlements } from "@/lib/billing-types"
import { commercialCycleTerms, EARLY_TERMINATION_PENALTY_PERCENT } from "@/lib/commercial-contract"

function limitLabel(value: number | null) {
  return value === null ? "Ilimitado" : String(value)
}

function usageLabel(used: number, limit: number | null) {
  return `${used} / ${limit === null ? "∞" : limit}`
}

function money(cents: number | null, currency: string) {
  if (cents == null) return "Indisponível"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100)
}

const featureLabels: Array<[keyof PlanEntitlements, string]> = [
  ["customDomain", "Domínio personalizado"],
  ["delivery", "Delivery"],
  ["kitchen", "Cozinha / KDS"],
  ["financial", "Financeiro"],
  ["loyalty", "Fidelidade"],
  ["modifiers", "Complementos"],
  ["inventory", "Estoque e ficha técnica"],
  ["advancedReports", "Relatórios avançados"],
]

export function BillingPanel() {
  const [billing, setBilling] = useState<BillingSnapshot | null>(null)
  const [plans, setPlans] = useState<CommercialPlan[]>([])
  const [trial, setTrial] = useState<{ active: boolean; startedAt: string; expiresAt: string; totalDays: number; daysRemaining: number } | null>(null)
  const [accountEmail, setAccountEmail] = useState("")
  const [commercialStatus, setCommercialStatus] = useState<CommercialBillingStatus | null>(null)
  const [cycle, setCycle] = useState<BillingCycle>("monthly")
  const [busyPlan, setBusyPlan] = useState("")
  const [error, setError] = useState("")

  async function load() {
    try {
      const [billingResponse, plansResponse, statusResponse] = await Promise.all([
        fetch("/api/admin/billing", { cache: "no-store" }),
        fetch("/api/billing/plans", { cache: "no-store" }),
        fetch("/api/billing/status", { cache: "no-store" }),
      ])
      const billingPayload = await billingResponse.json()
      const plansPayload = await plansResponse.json()
      const statusPayload = await statusResponse.json().catch(() => null)
      if (!billingResponse.ok) throw new Error(billingPayload.error || "Não foi possível carregar o plano.")
      if (!plansResponse.ok) throw new Error(plansPayload.error || "Não foi possível carregar os planos comerciais.")
      setBilling(billingPayload.billing)
      setTrial(billingPayload.trial || null)
      setAccountEmail(billingPayload.email || "")
      setPlans(plansPayload.plans || [])
      if (statusResponse.ok && statusPayload) setCommercialStatus(statusPayload)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao carregar cobrança.")
    }
  }

  useEffect(() => { void load() }, [])

  const statusLabel = useMemo(() => {
    if (trial?.active) return "7 dias grátis em andamento"
    switch (billing?.subscription?.status) {
      case "active": return "Ativa"
      case "trialing": return "Período de teste"
      case "past_due": return "Pagamento pendente"
      case "suspended": return "Suspensa"
      case "canceled": return "Cancelada"
      case "pending": return "Pendente"
      default: return "Sem assinatura"
    }
  }, [billing?.subscription?.status, trial?.active])

  function startCheckout(planCode: string) {
    setBusyPlan(planCode)
    setError("")
    window.location.assign(`/contratar?plano=${encodeURIComponent(planCode)}&ciclo=${encodeURIComponent(cycle)}`)
  }

  if (error && !billing) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div>
  }

  if (!billing) {
    return <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-5 text-sm font-semibold text-gray-600"><LoaderCircle className="h-4 w-4 animate-spin" />Carregando plano e limites...</div>
  }

  const limits = [
    { label: "Lojas", icon: Building2, used: billing.usage.organizations, limit: billing.entitlements.maxOrganizations },
    { label: "Usuários", icon: Users, used: billing.usage.users, limit: billing.entitlements.maxUsers },
    { label: "Produtos nesta loja", icon: Package, used: billing.usage.products, limit: billing.entitlements.maxProducts },
  ]
  const hasSemiannual = plans.some((plan) => plan.semiannualPriceCents != null)
  const hasAnnual = plans.some((plan) => plan.annualPriceCents != null)
  const scheduledCheckout = commercialStatus?.latestCheckout?.scheduledActivationAt
    ? commercialStatus.latestCheckout
    : null

  return (
    <div className="space-y-5">
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      {trial?.active && (
        <section className="overflow-hidden rounded-3xl border-2 border-orange-300 bg-orange-50 shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="flex items-center gap-4 bg-orange-600 p-6 text-white">
              <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/25">
                <span className="text-4xl font-black leading-none">{trial.daysRemaining}</span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-widest">dias</span>
              </div>
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-100">Seu teste grátis</p><p className="mt-1 text-xl font-black">Ainda está valendo</p><p className="mt-1 text-xs leading-5 text-orange-100">Você não perde os dias restantes ao contratar.</p></div>
            </div>
            <div className="p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Conta do proprietário</p>
              <p className="mt-2 text-lg font-black text-stone-950">{accountEmail || "Sua conta SaborFlow"}</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">O teste termina em <strong>{new Date(trial.expiresAt).toLocaleString("pt-BR")}</strong>. Seus dados, produtos, pedidos e configurações permanecem nesta mesma conta.</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-orange-100"><div className="h-full rounded-full bg-orange-600" style={{ width: `${Math.max(6, Math.min(100, ((trial.totalDays - trial.daysRemaining) / trial.totalDays) * 100))}%` }} /></div>
            </div>
          </div>
        </section>
      )}

      {scheduledCheckout && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Continuidade já garantida</p>
              <h2 className="mt-1 text-xl font-black text-emerald-950">{scheduledCheckout.planName} · {scheduledCheckout.billingCycle === "annual" ? "Anual" : scheduledCheckout.billingCycle === "semiannual" ? "Semestral" : "Mensal"}</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900">Seu plano foi contratado e está agendado para começar em <strong>{new Date(scheduledCheckout.scheduledActivationAt!).toLocaleString("pt-BR")}</strong>, depois do último dia grátis.</p>
            </div>
            <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-emerald-700 shadow-sm">Plano agendado</span>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Conta comercial</p>
            <h2 className="mt-1 text-2xl font-black text-gray-950">{trial?.active ? "Período gratuito" : billing.subscription?.planName || "Sem plano"}</h2>
            <p className="mt-2 text-sm text-gray-600">Status da assinatura: <strong>{statusLabel}</strong></p>
          </div>
          <div className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-black ${trial?.active || billing.subscription?.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
            <ShieldCheck className="h-4 w-4" />{trial?.active ? `${trial.daysRemaining} ${trial.daysRemaining === 1 ? "dia grátis restante" : "dias grátis restantes"}` : billing.subscription?.status === "active" ? "Assinatura válida" : "Ação necessária"}
          </div>
        </div>

        {billing.subscription?.internal && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            {trial?.active ? "Você está usando a gestão simples do período gratuito. Pode contratar agora: o plano pago será programado para começar somente depois do fim dos 7 dias." : "Esta conta está em uma modalidade interna do sistema. Ao contratar um plano comercial, a troca acontece após a confirmação do provedor."}
          </div>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {limits.map((item) => {
          const Icon = item.icon
          const available = item.limit === null || item.used < item.limit
          return (
            <article key={item.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-xl bg-amber-50 p-2.5 text-amber-800"><Icon className="h-5 w-5" /></div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${available ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{available ? "Disponível" : "Limite atingido"}</span>
              </div>
              <p className="mt-4 text-sm font-bold text-gray-500">{item.label}</p>
              <p className="mt-1 text-3xl font-black text-gray-950">{usageLabel(item.used, item.limit)}</p>
              <p className="mt-1 text-xs text-gray-400">Limite do plano: {limitLabel(item.limit)}</p>
            </article>
          )
        })}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-amber-700" /><h3 className="font-black text-gray-950">Recursos incluídos</h3></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {featureLabels.map(([key, label]) => {
            const enabled = Boolean(billing.entitlements[key])
            return (
              <div key={String(key)} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700">
                {enabled ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-gray-400" />}
                {label}
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-black text-gray-950">{trial?.active ? "Escolha como continuar depois do teste" : "Contratar ou fazer upgrade"}</h3><p className="mt-1 text-sm text-gray-500">{trial?.active ? "Se contratar antes do 7º dia, seu período grátis continua até o fim e o plano entra em seguida." : "O plano só muda depois da confirmação do pagamento pelo backend."}</p></div>
          {(hasSemiannual || hasAnnual) && <div className="flex flex-wrap rounded-xl bg-gray-100 p-1"><button onClick={() => setCycle("monthly")} className={`rounded-lg px-3 py-2 text-xs font-black ${cycle === "monthly" ? "bg-white shadow-sm" : "text-gray-500"}`}>Mensal</button>{hasSemiannual && <button onClick={() => setCycle("semiannual")} className={`rounded-lg px-3 py-2 text-xs font-black ${cycle === "semiannual" ? "bg-white shadow-sm" : "text-gray-500"}`}>Semestral</button>}{hasAnnual && <button onClick={() => setCycle("annual")} className={`rounded-lg px-3 py-2 text-xs font-black ${cycle === "annual" ? "bg-white shadow-sm" : "text-gray-500"}`}>Anual</button>}</div>}
        </div>
        {plans.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">Nenhum plano comercial foi publicado ainda.</div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {plans.map((plan) => {
              const price = cycle === "annual" ? plan.annualPriceCents : cycle === "semiannual" ? plan.semiannualPriceCents : plan.monthlyPriceCents
              return (
                <article key={plan.id} className="rounded-2xl border border-gray-200 p-4">
                  <p className="font-black text-gray-950">{plan.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{plan.description}</p>
                  <p className="mt-4 text-xl font-black">{cycle === "monthly" ? money(price, plan.currency) : `${money(commercialCycleTerms(cycle).installmentCents, plan.currency)}/mês`}</p>
                  {cycle !== "monthly" && <p className="mt-1 text-xs font-bold text-gray-500">Total contratual: {money(price, plan.currency)} · permanência de {commercialCycleTerms(cycle).commitmentMonths} meses · multa de {EARLY_TERMINATION_PENALTY_PERCENT}% sobre o saldo vincendo em rescisão antecipada, nos limites legais.</p>}
                  <button disabled={!price || Boolean(busyPlan) || Boolean(scheduledCheckout)} onClick={() => startCheckout(plan.code)} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gray-950 text-xs font-black text-white disabled:opacity-40">{busyPlan === plan.code ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{trial?.active ? "Contratar para depois do teste" : "Contratar"}</button>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
