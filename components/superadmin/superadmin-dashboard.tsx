"use client"

import { useMemo, useState } from "react"
import {
  Activity,
  BadgeDollarSign,
  Building2,
  CircleAlert,
  Database,
  Globe2,
  Headphones,
  ShieldCheck,
  TicketPercent,
  Users,
} from "lucide-react"
import type { SuperadminSnapshot } from "@/lib/superadmin-db"

function money(cents: number | null, currency = "BRL") {
  if (cents === null) return "—"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function date(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString("pt-BR")
}

const tabs = [
  "Visão geral",
  "Contas",
  "Empresas",
  "Planos",
  "Pagamentos",
  "Demos/Trials",
  "Domínios",
  "Cupons",
  "Suporte",
  "Logs",
] as const

type Tab = (typeof tabs)[number]

type ActionFn = (payload: Record<string, unknown>) => Promise<void>

function EntitlementOverride({
  accountId,
  busy,
  onApply,
}: {
  accountId: string
  busy: boolean
  onApply: ActionFn
}) {
  const [key, setKey] = useState("maxOrganizations")
  const [value, setValue] = useState("3")

  const booleanKey = !["maxOrganizations", "maxUsers", "maxProducts"].includes(key)

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
      <span className="text-xs font-black uppercase tracking-wider text-stone-500">
        Liberar recurso / limite
      </span>
      <select
        value={key}
        onChange={(event) => {
          const next = event.target.value
          setKey(next)
          setValue(["maxOrganizations", "maxUsers", "maxProducts"].includes(next) ? "3" : "true")
        }}
        className="rounded-lg border border-white/10 bg-stone-900 px-3 py-2 text-xs font-bold"
      >
        <option value="maxOrganizations">maxOrganizations</option>
        <option value="maxUsers">maxUsers</option>
        <option value="maxProducts">maxProducts</option>
        <option value="customDomain">customDomain</option>
        <option value="delivery">delivery</option>
        <option value="kitchen">kitchen</option>
        <option value="financial">financial</option>
        <option value="loyalty">loyalty</option>
        <option value="modifiers">modifiers</option>
        <option value="inventory">inventory</option>
        <option value="advancedReports">advancedReports</option>
      </select>
      {booleanKey ? (
        <select
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="rounded-lg border border-white/10 bg-stone-900 px-3 py-2 text-xs font-bold"
        >
          <option value="true">Liberado</option>
          <option value="false">Bloqueado</option>
        </select>
      ) : (
        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-24 rounded-lg border border-white/10 bg-stone-900 px-3 py-2 text-xs font-bold"
        />
      )}
      <button
        disabled={busy}
        onClick={() =>
          onApply({
            action: "set-entitlement",
            accountId,
            key,
            value: booleanKey ? value === "true" : Math.max(0, Number(value || 0)),
          })
        }
        className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-stone-950 disabled:opacity-40"
      >
        Aplicar override
      </button>
    </div>
  )
}

export function SuperadminDashboard({
  access,
  initialData,
}: {
  access: { email: string; role: string }
  initialData: SuperadminSnapshot
}) {
  const [data, setData] = useState(initialData)
  const [tab, setTab] = useState<Tab>("Visão geral")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const plans = useMemo(() => data.plans.filter((plan) => plan.active && !plan.internal), [data.plans])

  async function action(payload: Record<string, unknown>) {
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/superadmin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok) throw new Error(result.error || "Ação recusada.")

      const refresh = await fetch("/api/superadmin/overview", { cache: "no-store" })
      const refreshed = (await refresh.json()) as { data?: SuperadminSnapshot }
      if (refreshed.data) setData(refreshed.data)
      setMessage("Ação aplicada e registrada no log do Superadmin.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao executar ação.")
    } finally {
      setBusy(false)
    }
  }

  const metrics = [
    ["Usuários", data.metrics.users, Users],
    ["Contas", data.metrics.billingAccounts, BadgeDollarSign],
    ["Empresas", data.metrics.organizations, Building2],
    ["Assinaturas ativas", data.metrics.activeSubscriptions, ShieldCheck],
    ["Inadimplentes/suspensas", data.metrics.pastDueSubscriptions, CircleAlert],
    ["Trials ativos", data.metrics.activeTrials, Activity],
    ["Demos ativas", data.metrics.activeDemos, Database],
    ["Suporte aberto", data.metrics.openSupportCases, Headphones],
  ] as const

  return (
    <main className="min-h-screen bg-stone-950 text-white">
      <header className="border-b border-white/10 bg-stone-950/95 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              SaborFlow · Superadmin
            </p>
            <h1 className="mt-1 text-2xl font-black">Control Plane SaaS</h1>
          </div>
          <div className="text-right text-xs text-stone-400">
            <strong className="block text-white">{access.email}</strong>
            {access.role}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black ${
                tab === item
                  ? "bg-orange-500 text-stone-950"
                  : "bg-white/5 text-stone-300 hover:bg-white/10"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        {message && (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-200">
            {message}
          </div>
        )}

        {tab === "Visão geral" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(([label, value, Icon]) => (
              <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <Icon className="h-5 w-5 text-orange-400" />
                <p className="mt-4 text-3xl font-black">{value}</p>
                <p className="mt-1 text-sm text-stone-400">{label}</p>
              </article>
            ))}
          </div>
        )}

        {tab === "Contas" && (
          <div className="space-y-3">
            {data.accounts.map((account) => (
              <article key={account.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{account.ownerEmail || "Sem e-mail"}</p>
                    <p className="text-xs text-stone-500">{account.id}</p>
                    <p className="mt-2 text-sm text-stone-300">
                      {account.planName || "Sem plano"} · assinatura {account.subscriptionStatus || "—"} · {account.organizations} loja(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy || account.status === "active"}
                      onClick={() => action({ action: "set-account-status", accountId: account.id, status: "active" })}
                      className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-300 disabled:opacity-40"
                    >
                      Desbloquear
                    </button>
                    <button
                      disabled={busy || account.status === "suspended"}
                      onClick={() => action({ action: "set-account-status", accountId: account.id, status: "suspended" })}
                      className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-40"
                    >
                      Suspender
                    </button>
                    {account.subscriptionId && plans.length > 0 && (
                      <select
                        disabled={busy}
                        value={account.planId || ""}
                        onChange={(event) =>
                          action({
                            action: "change-plan",
                            subscriptionId: account.subscriptionId,
                            planId: event.target.value,
                          })
                        }
                        className="rounded-lg border border-white/10 bg-stone-900 px-3 py-2 text-xs font-bold"
                      >
                        {plans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-400">
                  <span>Status conta: {account.status}</span><span>•</span>
                  <span>Provider: {account.provider || "—"}</span><span>•</span>
                  <span>Vence: {date(account.currentPeriodEnd)}</span>
                </div>
                <EntitlementOverride accountId={account.id} busy={busy} onApply={action} />
              </article>
            ))}
          </div>
        )}

        {tab === "Empresas" && (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.organizations.map((organization) => (
              <article key={organization.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black">{organization.name}</p>
                    <p className="text-xs text-stone-500">/loja/{organization.slug}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{organization.status}</span>
                </div>
                <p className="mt-3 text-xs text-stone-400">
                  Criada em {date(organization.createdAt)} · pública: {organization.publicStoreEnabled ? "sim" : "não"}
                </p>
              </article>
            ))}
          </div>
        )}

        {tab === "Planos" && (
          <div className="grid gap-3 lg:grid-cols-3">
            {data.plans.map((plan) => (
              <article key={plan.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs font-black uppercase tracking-wider text-orange-400">{plan.code}</p>
                <h2 className="mt-2 text-xl font-black">{plan.name}</h2>
                <p className="mt-3 text-sm text-stone-300">
                  Mensal: {money(plan.monthlyPriceCents)}<br />Anual: {money(plan.annualPriceCents)}
                </p>
                <p className="mt-3 text-xs text-stone-500">
                  {plan.internal ? "interno" : "comercial"} · checkout {plan.checkoutEnabled ? "ativo" : "inativo"}
                </p>
              </article>
            ))}
          </div>
        )}

        {tab === "Pagamentos" && (
          <div className="space-y-2">
            {data.checkouts.map((checkout) => (
              <article key={checkout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div>
                  <p className="font-bold">{money(checkout.amountCents, checkout.currency)}</p>
                  <p className="text-xs text-stone-500">{checkout.provider} · {date(checkout.createdAt)}</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{checkout.status}</span>
              </article>
            ))}
          </div>
        )}

        {tab === "Demos/Trials" && (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.demos.map((demo) => (
              <article key={demo.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="font-black">{demo.organizationName}</p>
                <p className="mt-1 text-xs text-stone-400">{demo.kind} · {demo.status} · expira {date(demo.expiresAt)}</p>
              </article>
            ))}
          </div>
        )}

        {tab === "Domínios" && (
          <div className="space-y-2">
            {data.domains.map((domain) => (
              <article key={domain.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div>
                  <p className="font-black">{domain.domain}</p>
                  <p className="text-xs text-stone-500">{domain.organizationName}</p>
                </div>
                <Globe2 className={`h-5 w-5 ${domain.verified ? "text-emerald-400" : "text-stone-600"}`} />
              </article>
            ))}
          </div>
        )}

        {tab === "Cupons" && (
          <div className="space-y-4">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                void action({
                  action: "create-coupon",
                  code: form.get("code"),
                  description: form.get("description"),
                  discountType: form.get("discountType"),
                  discountValue: Number(form.get("discountValue")),
                })
                event.currentTarget.reset()
              }}
              className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:grid-cols-4"
            >
              <input name="code" required placeholder="Código" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm" />
              <input name="description" placeholder="Descrição" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm" />
              <select name="discountType" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm">
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo em centavos</option>
              </select>
              <div className="flex gap-2">
                <input name="discountValue" type="number" min="1" required placeholder="Valor" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm" />
                <button disabled={busy} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-stone-950">
                  <TicketPercent className="h-4 w-4" />
                </button>
              </div>
            </form>
            {data.coupons.map((coupon) => (
              <article key={coupon.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="font-black">{coupon.code}</p>
                <p className="text-xs text-stone-400">
                  {coupon.description || "Sem descrição"} · {coupon.discountType === "percent" ? `${coupon.discountValue}%` : money(coupon.discountValue)} · {coupon.active ? "ativo" : "inativo"}
                </p>
              </article>
            ))}
          </div>
        )}

        {tab === "Suporte" && (
          <div className="space-y-2">
            {data.support.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm text-stone-400">Nenhum chamado cadastrado.</p>
            )}
            {data.support.map((support) => (
              <article key={support.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div>
                  <p className="font-black">{support.subject}</p>
                  <p className="text-xs text-stone-500">{support.organizationName || support.billingEmail || "Sem vínculo"} · {support.priority} · {date(support.updatedAt)}</p>
                </div>
                <select
                  disabled={busy}
                  value={support.status}
                  onChange={(event) => action({ action: "support-status", caseId: support.id, status: event.target.value })}
                  className="rounded-lg border border-white/10 bg-stone-900 px-3 py-2 text-xs font-bold"
                >
                  <option value="open">Aberto</option>
                  <option value="pending">Pendente</option>
                  <option value="resolved">Resolvido</option>
                  <option value="closed">Fechado</option>
                </select>
              </article>
            ))}
          </div>
        )}

        {tab === "Logs" && (
          <div className="space-y-2">
            {data.logs.map((log) => (
              <article key={log.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-orange-400" />
                  <p className="font-black">{log.action}</p>
                </div>
                <p className="mt-1 text-xs text-stone-500">{log.adminEmail} · {log.targetType}:{log.targetId} · {date(log.createdAt)}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
