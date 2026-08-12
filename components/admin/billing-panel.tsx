"use client"

import { useEffect, useMemo, useState } from "react"
import { Building2, Check, CreditCard, LoaderCircle, Package, ShieldCheck, Users, X } from "lucide-react"
import type { BillingCycle, BillingSnapshot, CommercialPlan, PlanEntitlements } from "@/lib/billing-types"

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
  const [cycle, setCycle] = useState<BillingCycle>("monthly")
  const [busyPlan, setBusyPlan] = useState("")
  const [error, setError] = useState("")

  async function load() {
    try {
      const [billingResponse, plansResponse] = await Promise.all([
        fetch("/api/admin/billing", { cache: "no-store" }),
        fetch("/api/billing/plans", { cache: "no-store" }),
      ])
      const billingPayload = await billingResponse.json()
      const plansPayload = await plansResponse.json()
      if (!billingResponse.ok) throw new Error(billingPayload.error || "Não foi possível carregar o plano.")
      if (!plansResponse.ok) throw new Error(plansPayload.error || "Não foi possível carregar os planos comerciais.")
      setBilling(billingPayload.billing)
      setPlans(plansPayload.plans || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao carregar cobrança.")
    }
  }

  useEffect(() => { void load() }, [])

  const statusLabel = useMemo(() => {
    switch (billing?.subscription?.status) {
      case "active": return "Ativa"
      case "trialing": return "Período de teste"
      case "past_due": return "Pagamento pendente"
      case "suspended": return "Suspensa"
      case "canceled": return "Cancelada"
      case "pending": return "Pendente"
      default: return "Sem assinatura"
    }
  }, [billing?.subscription?.status])

  async function startCheckout(planCode: string) {
    setBusyPlan(planCode)
    setError("")
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingCycle: cycle }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível iniciar o checkout.")
      if (!payload.checkoutUrl) throw new Error("O provedor não retornou o link de pagamento.")
      window.location.assign(payload.checkoutUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao iniciar checkout.")
      setBusyPlan("")
    }
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
  const hasAnnual = plans.some((plan) => plan.annualPriceCents != null)

  return (
    <div className="space-y-5">
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Conta comercial</p>
            <h2 className="mt-1 text-2xl font-black text-gray-950">{billing.subscription?.planName || "Sem plano"}</h2>
            <p className="mt-2 text-sm text-gray-600">Status da assinatura: <strong>{statusLabel}</strong></p>
          </div>
          <div className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-black ${billing.subscription?.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
            <ShieldCheck className="h-4 w-4" />{billing.subscription?.status === "active" ? "Assinatura válida" : "Ação necessária"}
          </div>
        </div>

        {billing.subscription?.internal && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            Esta conta está no plano interno de compatibilidade. A operação existente continua ativa; ao contratar um plano comercial, a troca só acontece depois da confirmação do provedor pelo backend.
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
          <div><h3 className="font-black text-gray-950">Contratar ou fazer upgrade</h3><p className="mt-1 text-sm text-gray-500">O plano só muda depois da confirmação do pagamento pelo backend.</p></div>
          {hasAnnual && <div className="flex rounded-xl bg-gray-100 p-1"><button onClick={() => setCycle("monthly")} className={`rounded-lg px-3 py-2 text-xs font-black ${cycle === "monthly" ? "bg-white shadow-sm" : "text-gray-500"}`}>Mensal</button><button onClick={() => setCycle("annual")} className={`rounded-lg px-3 py-2 text-xs font-black ${cycle === "annual" ? "bg-white shadow-sm" : "text-gray-500"}`}>Anual</button></div>}
        </div>
        {plans.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">Nenhum plano comercial foi publicado ainda.</div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {plans.map((plan) => {
              const price = cycle === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents
              return (
                <article key={plan.id} className="rounded-2xl border border-gray-200 p-4">
                  <p className="font-black text-gray-950">{plan.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{plan.description}</p>
                  <p className="mt-4 text-xl font-black">{money(price, plan.currency)}</p>
                  <button disabled={!price || Boolean(busyPlan)} onClick={() => void startCheckout(plan.code)} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gray-950 text-xs font-black text-white disabled:opacity-40">{busyPlan === plan.code ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}Contratar</button>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
