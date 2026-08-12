"use client"

import { useEffect, useMemo, useState } from "react"
import { Building2, Check, CreditCard, LoaderCircle, Package, ShieldCheck, Users, X } from "lucide-react"
import type { BillingSnapshot, PlanEntitlements } from "@/lib/billing-types"

function limitLabel(value: number | null) {
  return value === null ? "Ilimitado" : String(value)
}

function usageLabel(used: number, limit: number | null) {
  return `${used} / ${limit === null ? "∞" : limit}`
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
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    fetch("/api/admin/billing", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o plano.")
        return payload.billing as BillingSnapshot
      })
      .then((value) => mounted && setBilling(value))
      .catch((reason) => mounted && setError(reason instanceof Error ? reason.message : "Erro ao carregar plano."))
    return () => { mounted = false }
  }, [])

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

  if (error) {
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

  return (
    <div className="space-y-5">
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
            Esta conta está no plano interno de compatibilidade criado para preservar a operação existente. Ele não libera novas lojas além do uso atual. A contratação e o upgrade serão conectados ao checkout na Fase 14.
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
    </div>
  )
}
