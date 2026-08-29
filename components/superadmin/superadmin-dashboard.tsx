"use client"

import { useEffect, useMemo, useState } from "react"
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
import type { PlatformFinanceSnapshot } from "@/lib/platform-finance"

function money(cents: number | null, currency = "BRL") {
  if (cents === null) return "—"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100)
}

function date(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString("pt-BR")
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function currentDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

const tabs = [
  "Visão geral",
  "Cadastros",
  "Empresas",
  "Contas",
  "Planos",
  "Pagamentos",
  "Cupons",
  "Demos/Trials",
  "DRE SaborFlow",
  "Domínios",
  "Suporte",
  "Logs",
] as const

type Tab = (typeof tabs)[number]
type ActionFn = (payload: Record<string, unknown>) => Promise<void>

const navigationGroups: Array<{ label: string; items: Tab[] }> = [
  { label: "Geral", items: ["Visão geral"] },
  { label: "Clientes", items: ["Cadastros", "Empresas", "Contas"] },
  { label: "Comercial", items: ["Planos", "Pagamentos", "Cupons", "Demos/Trials"] },
  { label: "Financeiro", items: ["DRE SaborFlow"] },
  { label: "Operação", items: ["Domínios", "Suporte"] },
  { label: "Segurança", items: ["Logs"] },
]

const tabDescriptions: Record<Tab, string> = {
  "Visão geral": "Resumo da saúde comercial e operacional da plataforma.",
  "Cadastros": "Validação e acompanhamento de novos cadastros comerciais.",
  "Empresas": "Empresas clientes e situação das lojas cadastradas.",
  "Contas": "Contas contratantes, planos, bloqueios e limites especiais.",
  "Planos": "Planos comerciais, preços, assinaturas e MRR contratado.",
  "Pagamentos": "Checkouts e movimentações de cobrança registradas.",
  "Cupons": "Cupons promocionais usados na contratação do SaborFlow.",
  "Demos/Trials": "Ambientes de demonstração e períodos de avaliação.",
  "DRE SaborFlow": "Receitas, despesas e resultado gerencial da plataforma.",
  "Domínios": "Domínios das empresas e situação de verificação.",
  "Suporte": "Chamados das empresas e acompanhamento de atendimento.",
  "Logs": "Auditoria das ações administrativas da plataforma.",
}

function EntitlementOverride({ accountId, busy, onApply }: { accountId: string; busy: boolean; onApply: ActionFn }) {
  const [key, setKey] = useState("maxOrganizations")
  const [value, setValue] = useState("3")
  const booleanKey = !["maxOrganizations", "maxUsers", "maxProducts"].includes(key)

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
      <span className="text-xs font-black uppercase tracking-wider text-stone-500">Recurso / limite</span>
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
        <option value="integrations">integrations</option>
      </select>
      {booleanKey ? (
        <select value={value} onChange={(event) => setValue(event.target.value)} className="rounded-lg border border-white/10 bg-stone-900 px-3 py-2 text-xs font-bold">
          <option value="true">Liberado</option>
          <option value="false">Bloqueado</option>
        </select>
      ) : (
        <input type="number" min="0" value={value} onChange={(event) => setValue(event.target.value)} className="w-24 rounded-lg border border-white/10 bg-stone-900 px-3 py-2 text-xs font-bold" />
      )}
      <button
        disabled={busy}
        onClick={() => onApply({ action: "set-entitlement", accountId, key, value: booleanKey ? value === "true" : Math.max(0, Number(value || 0)) })}
        className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-stone-950 disabled:opacity-40"
      >
        Aplicar override
      </button>
    </div>
  )
}

function RegistrationReviewCard({
  registration,
  busy,
  onApply,
}: {
  registration: SuperadminSnapshot["registrations"][number]
  busy: boolean
  onApply: ActionFn
}) {
  const [notes, setNotes] = useState(registration.notes || "")
  const statusClass = registration.status === "approved"
    ? "bg-emerald-500/15 text-emerald-300"
    : registration.status === "rejected"
      ? "bg-red-500/15 text-red-300"
      : "bg-amber-500/15 text-amber-300"

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-black">{registration.ownerName}</p>
          <p className="text-sm text-stone-300">{registration.ownerEmail}</p>
          <p className="mt-2 text-xs text-stone-500">
            {registration.planName || "Sem plano"} · assinatura {registration.subscriptionStatus || "—"} · {registration.organizations} empresa(s) · cadastro {date(registration.createdAt)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${statusClass}`}>{registration.status}</span>
      </div>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Observação da validação: documento pendente, contato confirmado, motivo da recusa..."
        className="mt-4 min-h-20 w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => onApply({ action: "review-registration", billingAccountId: registration.billingAccountId, status: "approved", notes })}
          className="rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-300 disabled:opacity-40"
        >
          Aprovar cadastro
        </button>
        <button
          disabled={busy}
          onClick={() => onApply({ action: "review-registration", billingAccountId: registration.billingAccountId, status: "rejected", notes })}
          className="rounded-xl bg-red-500/15 px-4 py-2 text-sm font-black text-red-300 disabled:opacity-40"
        >
          Rejeitar cadastro
        </button>
      </div>
    </article>
  )
}

function FinancePanel({ accessRole }: { accessRole: string }) {
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState<PlatformFinanceSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const canWrite = ["owner", "operator", "finance"].includes(accessRole)

  async function refreshFinance(targetMonth = month) {
    setBusy(true)
    try {
      const response = await fetch(`/api/superadmin/finance?month=${encodeURIComponent(targetMonth)}`, { cache: "no-store" })
      const result = await response.json() as { data?: PlatformFinanceSnapshot; error?: string }
      if (!response.ok || !result.data) throw new Error(result.error || "Falha ao carregar DRE da plataforma.")
      setData(result.data)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar DRE da plataforma.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refreshFinance(month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  async function financeAction(payload: Record<string, unknown>) {
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/superadmin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, month }),
      })
      const result = await response.json() as { data?: PlatformFinanceSnapshot; error?: string }
      if (!response.ok || !result.data) throw new Error(result.error || "Ação financeira recusada.")
      setData(result.data)
      setMessage("Financeiro da plataforma atualizado e ação registrada no log.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar financeiro da plataforma.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div>
          <h2 className="font-black">DRE gerencial da SaborFlow</h2>
          <p className="mt-1 text-xs text-stone-400">Custos da plataforma ficam separados do financeiro das empresas clientes.</p>
        </div>
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm font-bold" />
      </div>

      {message && <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-200">{message}</div>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-black uppercase text-stone-500">Receitas lançadas</p><p className="mt-2 text-2xl font-black">{money(data.dre.revenueCents)}</p></article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-black uppercase text-stone-500">Despesas do mês</p><p className="mt-2 text-2xl font-black">{money(data.dre.expenseCents)}</p><p className="mt-1 text-xs text-stone-500">pagas {money(data.dre.paidExpensesCents)} · abertas {money(data.dre.plannedExpensesCents)}</p></article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-black uppercase text-stone-500">Resultado gerencial</p><p className={`mt-2 text-2xl font-black ${data.dre.resultCents >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(data.dre.resultCents)}</p></article>
            <article className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.06] p-5"><p className="text-xs font-black uppercase text-orange-300">MRR contratado</p><p className="mt-2 text-2xl font-black">{money(data.contracted.mrrCents)}</p><p className="mt-1 text-xs text-stone-500">{data.contracted.activeCommercialSubscriptions} assinatura(s) comercial(is)</p></article>
          </div>

          <p className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-xs leading-5 text-amber-100/80">
            O MRR é indicador comercial contratado e não entra automaticamente como receita realizada na DRE. A DRE usa os lançamentos financeiros por competência; quando o gateway estiver em produção, receitas confirmadas poderão ser integradas pelo backend.
          </p>

          {canWrite && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                const raw = String(form.get("amount") || "0").replace(",", ".")
                void financeAction({
                  action: "create-entry",
                  competenceDate: form.get("competenceDate"),
                  entryType: form.get("entryType"),
                  category: form.get("category"),
                  description: form.get("description"),
                  counterparty: form.get("counterparty"),
                  amountCents: Math.round(Number(raw) * 100),
                  status: form.get("status"),
                  dueDate: form.get("dueDate") || null,
                  notes: form.get("notes"),
                })
                event.currentTarget.reset()
              }}
              className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:grid-cols-2 lg:grid-cols-4"
            >
              <select name="entryType" defaultValue="expense" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm"><option value="expense">Despesa</option><option value="revenue">Receita</option></select>
              <select name="category" defaultValue="Infraestrutura" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm">
                <option>Infraestrutura</option><option>Banco de dados</option><option>Domínio e DNS</option><option>E-mail</option><option>Gateway e taxas</option><option>Marketing</option><option>Suporte</option><option>Contabilidade</option><option>Impostos</option><option>Ferramentas</option><option>Pessoal</option><option>Receita SaaS</option><option>Outras receitas</option><option>Outros custos</option>
              </select>
              <input name="description" required placeholder="Descrição" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm" />
              <input name="counterparty" placeholder="Fornecedor / origem" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm" />
              <input name="amount" required type="number" min="0.01" step="0.01" placeholder="Valor em R$" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm" />
              <input name="competenceDate" required type="date" defaultValue={currentDate()} className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm" />
              <input name="dueDate" type="date" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm" />
              <select name="status" defaultValue="planned" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm"><option value="planned">Previsto / em aberto</option><option value="paid">Pago / recebido</option></select>
              <input name="notes" placeholder="Observações" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm md:col-span-2 lg:col-span-3" />
              <button disabled={busy} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-stone-950 disabled:opacity-40">Adicionar lançamento</button>
            </form>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="space-y-2">
              {data.entries.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm text-stone-400">Nenhum lançamento nesta competência.</p>}
              {data.entries.map((entry) => (
                <article key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div>
                    <p className="font-black">{entry.description}</p>
                    <p className="mt-1 text-xs text-stone-500">{entry.category} · {entry.counterparty || "sem contraparte"} · competência {entry.competenceDate}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-black ${entry.entryType === "revenue" ? "text-emerald-300" : "text-white"}`}>{entry.entryType === "revenue" ? "+" : "−"}{money(entry.amountCents, entry.currency)}</p>
                    {canWrite ? (
                      <select disabled={busy} value={entry.status} onChange={(event) => void financeAction({ action: "set-status", entryId: entry.id, status: event.target.value })} className="mt-1 rounded-lg border border-white/10 bg-stone-900 px-2 py-1 text-xs font-bold">
                        <option value="planned">em aberto</option><option value="paid">pago/recebido</option><option value="canceled">cancelado</option>
                      </select>
                    ) : <p className="text-xs text-stone-500">{entry.status}</p>}
                  </div>
                </article>
              ))}
            </div>
            <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="font-black">Despesas por categoria</h3>
              <div className="mt-4 space-y-3">
                {data.expensesByCategory.length === 0 && <p className="text-sm text-stone-500">Sem despesas no mês.</p>}
                {data.expensesByCategory.map((item) => <div key={item.category} className="flex items-center justify-between gap-3 text-sm"><span className="text-stone-300">{item.category}</span><strong>{money(item.amountCents)}</strong></div>)}
              </div>
            </aside>
          </div>
        </>
      )}
      {!data && busy && <p className="text-sm text-stone-400">Carregando financeiro da plataforma...</p>}
    </div>
  )
}

export function SuperadminDashboard({ access, initialData }: { access: { email: string; role: string }; initialData: SuperadminSnapshot }) {
  const [data, setData] = useState(initialData)
  const [tab, setTab] = useState<Tab>("Visão geral")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const plans = useMemo(() => data.plans.filter((plan) => plan.active && !plan.internal), [data.plans])

  async function action(payload: Record<string, unknown>) {
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/superadmin/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const result = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok) throw new Error(result.error || "Ação recusada.")
      const refresh = await fetch("/api/superadmin/overview", { cache: "no-store" })
      const refreshed = await refresh.json() as { data?: SuperadminSnapshot }
      if (refreshed.data) setData(refreshed.data)
      setMessage("Ação aplicada e registrada no log do Superadmin.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao executar ação.")
    } finally {
      setBusy(false)
    }
  }

  const metrics = [
    ["Cadastros aguardando validação", data.metrics.pendingRegistrations, ShieldCheck],
    ["Contas contratantes", data.metrics.billingAccounts, BadgeDollarSign],
    ["Empresas clientes", data.metrics.organizations, Building2],
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
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">SaborFlow · Operação da plataforma</p><h1 className="mt-1 text-2xl font-black">Superadmin SaaS</h1><p className="mt-1 text-xs text-stone-500">Este painel administra o SaborFlow; não é o painel operacional de uma empresa cliente.</p></div>
          <div className="text-right text-xs text-stone-400"><strong className="block text-white">{access.email}</strong>{access.role}</div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <select
          value={tab}
          onChange={(event) => setTab(event.target.value as Tab)}
          className="mb-4 w-full rounded-xl border border-white/10 bg-stone-900 px-4 py-3 text-sm font-black text-white outline-none lg:hidden"
          aria-label="Seção do Superadmin"
        >
          {tabs.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="px-3 pb-3 pt-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Navegação</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">Áreas administrativas da plataforma.</p>
              </div>

              <div className="space-y-4">
                {navigationGroups.map((group) => (
                  <div key={group.label}>
                    <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-stone-600">{group.label}</p>
                    <div className="mt-1 space-y-1">
                      {group.items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setTab(item)}
                          className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-black transition ${
                            tab === item
                              ? "bg-orange-500 text-stone-950"
                              : "text-stone-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">{tab}</p>
              <p className="mt-1 text-sm text-stone-400">{tabDescriptions[tab]}</p>
            </div>

            {message && <div className="mb-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-200">{message}</div>}

        {tab === "Visão geral" && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map(([label, value, Icon]) => (
                <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <Icon className="h-5 w-5 text-orange-400" />
                  <p className="mt-4 text-3xl font-black">{value}</p>
                  <p className="mt-1 text-sm text-stone-400">{label}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
              <article className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.06] p-5">
                <p className="text-xs font-black uppercase tracking-wider text-orange-300">MRR comercial contratado</p>
                <p className="mt-2 text-3xl font-black">{money(data.metrics.contractedMrrCents)}</p>
                <p className="mt-1 text-xs text-stone-500">Indicador comercial; não é tratado como receita realizada da DRE.</p>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs font-black uppercase tracking-wider text-stone-400">Atenção necessária</p>
                <div className="mt-4 space-y-3 text-sm">
                  <button type="button" onClick={() => setTab("Cadastros")} className="flex w-full items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-left hover:bg-black/30">
                    <span className="text-stone-300">Cadastros pendentes</span>
                    <strong className="text-amber-300">{data.metrics.pendingRegistrations}</strong>
                  </button>
                  <button type="button" onClick={() => setTab("Contas")} className="flex w-full items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-left hover:bg-black/30">
                    <span className="text-stone-300">Inadimplentes/suspensas</span>
                    <strong className="text-red-300">{data.metrics.pastDueSubscriptions}</strong>
                  </button>
                  <button type="button" onClick={() => setTab("Suporte")} className="flex w-full items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-left hover:bg-black/30">
                    <span className="text-stone-300">Chamados abertos</span>
                    <strong className="text-orange-300">{data.metrics.openSupportCases}</strong>
                  </button>
                </div>
              </article>
            </div>
          </div>
        )}

        {tab === "Cadastros" && <div className="space-y-3">{data.registrations.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm text-stone-400">Nenhum cadastro comercial na fila.</p>}{data.registrations.map((registration) => <RegistrationReviewCard key={registration.id} registration={registration} busy={busy} onApply={action} />)}</div>}

        {tab === "Contas" && <div className="space-y-3">{data.accounts.map((account) => <article key={account.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{account.ownerEmail || "Sem e-mail"}</p><p className="text-xs text-stone-500">{account.id}</p><p className="mt-2 text-sm text-stone-300">{account.planName || "Sem plano"} · assinatura {account.subscriptionStatus || "—"} · {account.organizations} loja(s)</p></div><div className="flex flex-wrap gap-2"><button disabled={busy || account.status === "active"} onClick={() => action({ action: "set-account-status", accountId: account.id, status: "active" })} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-300 disabled:opacity-40">Desbloquear</button><button disabled={busy || account.status === "suspended"} onClick={() => action({ action: "set-account-status", accountId: account.id, status: "suspended" })} className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-40">Suspender</button>{account.subscriptionId && plans.length > 0 && <select disabled={busy} value={account.planId || ""} onChange={(event) => action({ action: "change-plan", subscriptionId: account.subscriptionId, planId: event.target.value })} className="rounded-lg border border-white/10 bg-stone-900 px-3 py-2 text-xs font-bold">{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select>}</div></div><div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-400"><span>Status conta: {account.status}</span><span>•</span><span>Provider: {account.provider || "—"}</span><span>•</span><span>Vence: {date(account.currentPeriodEnd)}</span></div><EntitlementOverride accountId={account.id} busy={busy} onApply={action} /></article>)}</div>}

        {tab === "Planos" && <div className="grid gap-3 lg:grid-cols-3">{data.plans.map((plan) => <article key={plan.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-black uppercase tracking-wider text-orange-400">{plan.code}</p><h2 className="mt-2 text-xl font-black">{plan.name}</h2><p className="mt-3 text-sm text-stone-300">Mensal: {money(plan.monthlyPriceCents)}<br />Anual: {money(plan.annualPriceCents)}</p><div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-3 text-xs"><div><span className="text-stone-500">Ativas</span><strong className="block text-lg text-white">{plan.activeSubscriptions}</strong></div><div><span className="text-stone-500">MRR</span><strong className="block text-lg text-white">{money(plan.mrrCents)}</strong></div></div><p className="mt-3 text-xs text-stone-500">{plan.internal ? "interno" : "comercial"} · checkout {plan.checkoutEnabled ? "ativo" : "inativo"} · plano {plan.active ? "ativo" : "inativo"}</p></article>)}</div>}

        {tab === "DRE SaborFlow" && <FinancePanel accessRole={access.role} />}

        {tab === "Empresas" && <div className="grid gap-3 lg:grid-cols-2">{data.organizations.map((organization) => <article key={organization.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="flex items-center justify-between gap-3"><div><p className="font-black">{organization.name}</p><p className="text-xs text-stone-500">/loja/{organization.slug}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{organization.status}</span></div><p className="mt-3 text-xs text-stone-400">Criada em {date(organization.createdAt)} · pública: {organization.publicStoreEnabled ? "sim" : "não"}</p></article>)}</div>}

        {tab === "Pagamentos" && <div className="space-y-2">{data.checkouts.map((checkout) => <article key={checkout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4"><div><p className="font-bold">{money(checkout.amountCents, checkout.currency)}</p><p className="text-xs text-stone-500">{checkout.provider} · {date(checkout.createdAt)}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{checkout.status}</span></article>)}</div>}

        {tab === "Demos/Trials" && <div className="grid gap-3 lg:grid-cols-2">{data.demos.map((demo) => <article key={demo.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="font-black">{demo.organizationName}</p><p className="mt-1 text-xs text-stone-400">{demo.kind} · {demo.status} · expira {date(demo.expiresAt)}</p></article>)}</div>}

        {tab === "Domínios" && <div className="space-y-2">{data.domains.map((domain) => <article key={domain.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4"><div><p className="font-black">{domain.domain}</p><p className="text-xs text-stone-500">{domain.organizationName}</p></div><Globe2 className={`h-5 w-5 ${domain.verified ? "text-emerald-400" : "text-stone-600"}`} /></article>)}</div>}

        {tab === "Cupons" && <div className="space-y-4"><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void action({ action: "create-coupon", code: form.get("code"), description: form.get("description"), discountType: form.get("discountType"), discountValue: Number(form.get("discountValue")) }); event.currentTarget.reset() }} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:grid-cols-4"><input name="code" required placeholder="Código" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm" /><input name="description" placeholder="Descrição" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm" /><select name="discountType" className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm"><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo em centavos</option></select><div className="flex gap-2"><input name="discountValue" type="number" min="1" required placeholder="Valor" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm" /><button disabled={busy} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-stone-950"><TicketPercent className="h-4 w-4" /></button></div></form>{data.coupons.map((coupon) => <article key={coupon.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="font-black">{coupon.code}</p><p className="text-xs text-stone-400">{coupon.description || "Sem descrição"} · {coupon.discountType === "percent" ? `${coupon.discountValue}%` : money(coupon.discountValue)} · {coupon.active ? "ativo" : "inativo"}</p></article>)}</div>}

        {tab === "Suporte" && <div className="space-y-2">{data.support.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm text-stone-400">Nenhum chamado cadastrado.</p>}{data.support.map((support) => <article key={support.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4"><div><p className="font-black">{support.subject}</p><p className="text-xs text-stone-500">{support.organizationName || support.billingEmail || "Sem vínculo"} · {support.priority} · {date(support.updatedAt)}</p></div><select disabled={busy} value={support.status} onChange={(event) => action({ action: "support-status", caseId: support.id, status: event.target.value })} className="rounded-lg border border-white/10 bg-stone-900 px-3 py-2 text-xs font-bold"><option value="open">Aberto</option><option value="pending">Pendente</option><option value="resolved">Resolvido</option><option value="closed">Fechado</option></select></article>)}</div>}

        {tab === "Logs" && <div className="space-y-2">{data.logs.map((log) => <article key={log.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-orange-400" /><p className="font-black">{log.action}</p></div><p className="mt-1 text-xs text-stone-500">{log.adminEmail} · {log.targetType}:{log.targetId} · {date(log.createdAt)}</p></article>)}</div>}
          </section>
        </div>
      </div>
    </main>
  )
}
