"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  Download,
  LineChart,
  PackageSearch,
  ReceiptText,
  RefreshCcw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react"
import type {
  ManagementReport,
  ManagementReportScope,
  ReportBreakdown,
} from "@/lib/reports-types"

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function initialPeriod() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 29)
  return { start: dateInputValue(start), end: dateInputValue(end) }
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs font-bold text-stone-400">sem base anterior</span>
  const positive = value >= 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-black ${positive ? "text-emerald-700" : "text-red-700"}`}>
      {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {positive ? "+" : ""}{value.toFixed(1)}%
    </span>
  )
}

function BreakdownList({ title, rows }: { title: string; rows: ReportBreakdown[] }) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-black text-stone-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.length === 0 && <p className="text-sm text-stone-500">Sem dados no período.</p>}
        {rows.map((row) => (
          <div key={row.key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-stone-700">{row.label}</span>
              <span className="font-black text-stone-950">{money.format(row.revenue)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, Math.max(2, row.sharePercent))}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-stone-500">{integer.format(row.orders)} pedidos · {row.sharePercent.toFixed(1)}% do faturamento</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function ReportsDashboard({ currentOrganizationName }: { currentOrganizationName: string }) {
  const period = useMemo(initialPeriod, [])
  const [start, setStart] = useState(period.start)
  const [end, setEnd] = useState(period.end)
  const [scope, setScope] = useState<ManagementReportScope>("organization")
  const [report, setReport] = useState<ManagementReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load(nextScope = scope) {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ start, end, scope: nextScope })
      const response = await fetch(`/api/admin/reports?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os relatórios.")
      setReport(payload as ManagementReport)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar relatórios.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load("organization")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exportHref(dataset: "summary" | "products" | "daily" | "units") {
    const params = new URLSearchParams({ start, end, scope, dataset })
    return `/api/admin/reports/export?${params.toString()}`
  }

  const maxDailyRevenue = Math.max(1, ...(report?.daily.map((item) => item.revenue) || [1]))

  return (
    <main className="min-h-screen bg-[#fff8ef] text-stone-950">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-stone-950 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a href="/admin" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-300 hover:text-amber-200">
              <ArrowLeft className="h-4 w-4" /> Voltar ao painel
            </a>
            <h1 className="mt-3 text-2xl font-black sm:text-3xl">Relatórios e inteligência gerencial</h1>
            <p className="mt-1 text-sm text-stone-300">{scope === "group" ? "Consolidado do grupo empresarial" : currentOrganizationName} · análise somente leitura</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-xs font-bold text-stone-200">
            <LineChart className="h-5 w-5 text-amber-300" /> FASE 20
          </div>
        </header>

        <section className="mt-5 grid gap-3 rounded-3xl border border-amber-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <label className="text-xs font-black uppercase tracking-wide text-stone-500">
            <span className="mb-2 block">Período inicial</span>
            <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm font-bold text-stone-800 outline-none focus:border-amber-400" />
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-stone-500">
            <span className="mb-2 block">Período final</span>
            <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm font-bold text-stone-800 outline-none focus:border-amber-400" />
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-stone-500">
            <span className="mb-2 block">Escopo</span>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as ManagementReportScope)}
              className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-800 outline-none focus:border-amber-400"
            >
              <option value="organization">Loja atual</option>
              {report?.scope.groupAvailable && <option value="group">Grupo empresarial</option>}
            </select>
          </label>
          <button onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50">
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </section>

        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {loading && !report && <div className="mt-8 rounded-3xl border border-stone-200 bg-white p-10 text-center text-sm font-bold text-stone-500">Carregando inteligência gerencial...</div>}

        {report && (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                { label: "Faturamento", value: money.format(report.metrics.revenue), delta: report.comparison.revenue.percent, icon: WalletCards },
                { label: "Pedidos", value: integer.format(report.metrics.orders), delta: report.comparison.orders.percent, icon: ShoppingBag },
                { label: "Ticket médio", value: money.format(report.metrics.averageTicket), delta: report.comparison.averageTicket.percent, icon: ReceiptText },
                { label: "Concluídos", value: integer.format(report.metrics.completedOrders), delta: report.comparison.completedOrders.percent, icon: BarChart3 },
                { label: "Cancelamento", value: `${report.metrics.cancellationRatePercent.toFixed(1)}%`, delta: null, icon: TrendingDown },
                { label: "Não pago", value: money.format(report.metrics.unpaidRevenue), delta: null, icon: WalletCards },
              ].map((card) => {
                const Icon = card.icon
                return (
                  <article key={card.label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-wide text-stone-500">{card.label}</p><Icon className="h-4 w-4 text-amber-700" /></div>
                    <p className="mt-2 text-xl font-black text-stone-950">{card.value}</p>
                    {card.delta !== null && <div className="mt-1"><Delta value={card.delta} /></div>}
                  </article>
                )
              })}
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_.8fr]">
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><h2 className="text-lg font-black">Evolução diária</h2><p className="text-sm text-stone-500">Faturamento e quantidade de pedidos no período selecionado.</p></div>
                  <a href={exportHref("daily")} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700 hover:bg-stone-50"><Download className="h-4 w-4" /> CSV diário</a>
                </div>
                <div className="mt-5 flex min-h-56 items-end gap-1 overflow-x-auto border-b border-stone-100 pb-3">
                  {report.daily.length === 0 && <p className="m-auto text-sm text-stone-500">Sem pedidos no período.</p>}
                  {report.daily.map((point) => (
                    <div key={point.date} className="group flex min-w-8 flex-1 flex-col items-center justify-end gap-1" title={`${point.date}: ${money.format(point.revenue)} · ${point.orders} pedidos`}>
                      <span className="hidden text-[9px] font-bold text-stone-500 group-hover:block">{point.orders}</span>
                      <div className="w-full rounded-t-md bg-amber-500 transition group-hover:bg-amber-600" style={{ height: `${Math.max(5, (point.revenue / maxDailyRevenue) * 170)}px` }} />
                      <span className="rotate-[-45deg] whitespace-nowrap text-[9px] text-stone-400">{point.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="rounded-3xl bg-stone-950 p-5 text-white shadow-sm">
                <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-amber-300" /><h2 className="text-lg font-black">Leituras automáticas</h2></div>
                <div className="mt-4 space-y-3">
                  {report.insights.map((insight) => <p key={insight} className="rounded-2xl bg-white/10 p-3 text-sm leading-6 text-stone-200">{insight}</p>)}
                </div>
              </aside>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3"><PackageSearch className="h-5 w-5 text-amber-700" /><div><h2 className="text-lg font-black">Produtos que mais vendem</h2><p className="text-sm text-stone-500">Ranking por faturamento, com volume e participação.</p></div></div>
                  <a href={exportHref("products")} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700 hover:bg-stone-50"><Download className="h-4 w-4" /> Exportar</a>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-[680px] w-full text-left text-sm">
                    <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Qtd.</th><th className="px-3 py-3">Pedidos</th><th className="px-3 py-3">Faturamento</th><th className="px-3 py-3">Participação</th></tr></thead>
                    <tbody>{report.products.map((product, index) => <tr key={product.name} className="border-b border-stone-100"><td className="px-3 py-3 font-black text-stone-900"><span className="mr-2 text-xs text-amber-700">#{index + 1}</span>{product.name}</td><td className="px-3 py-3 font-bold">{integer.format(product.quantity)}</td><td className="px-3 py-3">{integer.format(product.orders)}</td><td className="px-3 py-3 font-black">{money.format(product.revenue)}</td><td className="px-3 py-3">{product.sharePercent.toFixed(1)}%</td></tr>)}</tbody>
                  </table>
                  {report.products.length === 0 && <p className="py-8 text-center text-sm text-stone-500">Sem itens vendidos no período.</p>}
                </div>
              </div>

              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3"><Users className="h-5 w-5 text-amber-700" /><div><h2 className="text-lg font-black">Recorrência de clientes</h2><p className="text-sm text-stone-500">Clientes identificados por telefone, e-mail ou nome.</p></div></div>
                <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-stone-50 p-4"><p className="text-xs font-bold text-stone-500">Identificados</p><p className="mt-1 text-2xl font-black">{report.customers.identifiedCustomers}</p></div><div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">Recorrência</p><p className="mt-1 text-2xl font-black text-amber-900">{report.customers.returningRatePercent.toFixed(1)}%</p></div></div>
                <div className="mt-4 space-y-2">{report.customers.top.slice(0, 5).map((customer) => <div key={`${customer.name}-${customer.revenue}`} className="flex items-center justify-between rounded-xl border border-stone-100 p-3"><div><p className="font-black text-stone-900">{customer.name}</p><p className="text-xs text-stone-500">{customer.orders} pedidos · ticket {money.format(customer.averageTicket)}</p></div><p className="font-black text-stone-950">{money.format(customer.revenue)}</p></div>)}</div>
              </div>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-3">
              <BreakdownList title="Canais de venda" rows={report.channels} />
              <BreakdownList title="Formas de pagamento" rows={report.payments} />
              <BreakdownList title="Entrega x retirada" rows={report.fulfillment} />
            </section>

            {scope === "group" && report.units.length > 0 && (
              <section className="mt-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-amber-700" /><div><h2 className="text-lg font-black">Comparativo de unidades</h2><p className="text-sm text-stone-500">Ranking consolidado sem conceder acesso operacional entre filiais.</p></div></div><a href={exportHref("units")} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700 hover:bg-stone-50"><Download className="h-4 w-4" /> CSV unidades</a></div>
                <div className="mt-4 overflow-x-auto"><table className="min-w-[720px] w-full text-left text-sm"><thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="px-3 py-3">Unidade</th><th className="px-3 py-3">Pedidos</th><th className="px-3 py-3">Faturamento</th><th className="px-3 py-3">Ticket médio</th><th className="px-3 py-3">Participação</th></tr></thead><tbody>{report.units.map((unit) => <tr key={unit.organizationId} className="border-b border-stone-100"><td className="px-3 py-3 font-black">{unit.name}</td><td className="px-3 py-3">{unit.orders}</td><td className="px-3 py-3 font-black">{money.format(unit.revenue)}</td><td className="px-3 py-3">{money.format(unit.averageTicket)}</td><td className="px-3 py-3">{unit.sharePercent.toFixed(1)}%</td></tr>)}</tbody></table></div>
              </section>
            )}

            <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_.7fr]">
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-amber-700" /><div><h2 className="text-lg font-black">Comparação de período</h2><p className="text-sm text-stone-500">{report.period.start} a {report.period.end} versus {report.period.previousStart} a {report.period.previousEnd}.</p></div></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
                  ["Pedidos", integer.format(report.comparison.orders.current), report.comparison.orders.percent],
                  ["Faturamento", money.format(report.comparison.revenue.current), report.comparison.revenue.percent],
                  ["Ticket médio", money.format(report.comparison.averageTicket.current), report.comparison.averageTicket.percent],
                  ["Concluídos", integer.format(report.comparison.completedOrders.current), report.comparison.completedOrders.percent],
                ].map(([label, value, delta]) => <div key={String(label)} className="rounded-2xl bg-stone-50 p-4"><p className="text-xs font-bold text-stone-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p><div className="mt-1"><Delta value={delta as number | null} /></div></div>)}</div>
              </div>
              <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-black text-amber-950">Financeiro gerencial</h2><p className="mt-2 text-sm leading-6 text-amber-900">Entradas manuais: <strong>{money.format(report.metrics.manualIncome)}</strong><br />Despesas manuais: <strong>{money.format(report.metrics.manualExpenses)}</strong><br />Saldo manual: <strong>{money.format(report.metrics.manualResult)}</strong></p><p className="mt-3 text-xs leading-5 text-amber-800">A composição contábil/gerencial detalhada continua na DRE. Este painel usa o financeiro apenas como indicador complementar.</p></aside>
            </section>

            <footer className="mt-5 flex flex-col gap-3 rounded-3xl border border-stone-200 bg-white p-5 text-sm text-stone-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p><strong>Escopo:</strong> {report.scope.organizationNames.join(", ")} · timezone {report.scope.timeZone} · máximo de {report.boundaries.maxRangeDays} dias.</p>
              <a href={exportHref("summary")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-black text-white"><Download className="h-4 w-4" /> Exportar resumo CSV</a>
            </footer>
          </>
        )}
      </div>
    </main>
  )
}
