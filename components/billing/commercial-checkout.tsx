"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Check, CreditCard, LoaderCircle, LockKeyhole, LogIn, Mail, UserRound } from "lucide-react"
import type { BillingCycle, CommercialBillingStatus, CommercialPlan } from "@/lib/billing-types"

function money(cents: number | null, currency: string) {
  if (cents == null) return "Indisponível"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100)
}

function limit(value: number | null) {
  return value === null ? "Ilimitado" : String(value)
}

export function CommercialCheckout() {
  const [plans, setPlans] = useState<CommercialPlan[]>([])
  const [status, setStatus] = useState<CommercialBillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<"signup" | "signin">("signup")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [cycle, setCycle] = useState<BillingCycle>("monthly")

  async function load() {
    setLoading(true)
    try {
      const [plansResponse, statusResponse] = await Promise.all([
        fetch("/api/billing/plans", { cache: "no-store" }),
        fetch("/api/billing/status", { cache: "no-store" }),
      ])
      const plansPayload = await plansResponse.json()
      if (!plansResponse.ok) throw new Error(plansPayload.error || "Não foi possível carregar os planos.")
      setPlans(plansPayload.plans || [])
      if (statusResponse.ok) setStatus(await statusResponse.json())
      else setStatus(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar contratação.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const hasAnnual = useMemo(() => plans.some((plan) => plan.annualPriceCents != null), [plans])

  async function authenticate(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const endpoint = mode === "signup" ? "/api/billing/signup" : "/api/billing/sign-in"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível continuar.")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível continuar.")
    } finally {
      setBusy(false)
    }
  }

  async function checkout(planCode: string) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingCycle: cycle }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível iniciar o pagamento.")
      if (!payload.checkoutUrl) throw new Error("O provedor não retornou o link de pagamento.")
      window.location.assign(payload.checkoutUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível iniciar o pagamento.")
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center gap-2 rounded-3xl border border-gray-200 bg-white p-10 text-sm font-bold text-gray-600"><LoaderCircle className="h-5 w-5 animate-spin" />Carregando contratação...</div>
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      {!status?.authenticated ? (
        <section className="mx-auto max-w-xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex rounded-xl bg-gray-100 p-1">
            <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${mode === "signup" ? "bg-white shadow-sm" : "text-gray-500"}`}>Criar conta</button>
            <button type="button" onClick={() => setMode("signin")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${mode === "signin" ? "bg-white shadow-sm" : "text-gray-500"}`}>Já tenho conta</button>
          </div>
          <form onSubmit={authenticate} className="mt-6 space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">Nome</span>
                <div className="relative"><UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input required value={name} onChange={(event) => setName(event.target.value)} className="h-12 w-full rounded-xl border border-gray-200 pl-9 pr-3 outline-none focus:border-amber-500" /></div>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">E-mail</span>
              <div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-gray-200 pl-9 pr-3 outline-none focus:border-amber-500" /></div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">Senha</span>
              <div className="relative"><LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-gray-200 pl-9 pr-3 outline-none focus:border-amber-500" /></div>
            </label>
            <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}{mode === "signup" ? "Criar conta e escolher plano" : "Entrar para contratar"}</button>
          </form>
        </section>
      ) : (
        <>
          {status.billing?.subscription?.status === "active" && !status.billing.subscription.internal && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Sua assinatura <strong>{status.billing.subscription.planName}</strong> já está ativa. {status.hasOrganization ? <a href="/admin" className="underline">Voltar ao painel</a> : <a href="/admin/nova-empresa" className="underline">Configurar sua primeira loja</a>}.</div>
          )}

          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-wider text-gray-400">Conta contratante</p><p className="font-bold text-gray-900">{status.email}</p></div>
            {hasAnnual && <div className="flex rounded-xl bg-gray-100 p-1"><button onClick={() => setCycle("monthly")} className={`rounded-lg px-4 py-2 text-sm font-black ${cycle === "monthly" ? "bg-white shadow-sm" : "text-gray-500"}`}>Mensal</button><button onClick={() => setCycle("annual")} className={`rounded-lg px-4 py-2 text-sm font-black ${cycle === "annual" ? "bg-white shadow-sm" : "text-gray-500"}`}>Anual</button></div>}
          </div>

          {plans.length === 0 ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-relaxed text-amber-900">Nenhum plano comercial foi publicado ainda. A infraestrutura de cobrança está pronta, mas preço e limites precisam ser definidos pelo operador do SaborFlow antes de abrir vendas.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => {
                const price = cycle === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents
                return (
                  <article key={plan.id} className="flex flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-black text-gray-950">{plan.name}</h2>
                    <p className="mt-2 min-h-10 text-sm text-gray-600">{plan.description}</p>
                    <p className="mt-5 text-3xl font-black text-gray-950">{money(price, plan.currency)}</p>
                    <p className="text-xs font-bold text-gray-400">por {cycle === "annual" ? "ano" : "mês"}</p>
                    <div className="mt-5 space-y-2 text-sm text-gray-700">
                      <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Até {limit(plan.entitlements.maxOrganizations)} loja(s)</p>
                      <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Até {limit(plan.entitlements.maxUsers)} usuário(s)</p>
                      <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Até {limit(plan.entitlements.maxProducts)} produto(s)</p>
                    </div>
                    <button disabled={busy || price == null} onClick={() => void checkout(plan.code)} className="mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-gray-950 text-sm font-black text-white hover:bg-black disabled:opacity-40"><CreditCard className="h-4 w-4" />Contratar {plan.name}</button>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
