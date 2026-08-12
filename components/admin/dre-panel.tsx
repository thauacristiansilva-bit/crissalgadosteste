"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, RefreshCw, TrendingDown, TrendingUp } from "lucide-react"
import type { DreReport } from "@/lib/dre-types"
import { HelpLabel, HelpTip } from "@/components/admin/help-tip"
import type { AdminHelpKey } from "@/lib/admin-help"

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const shortDate = (value: string) => {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function zonedDateString(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`
}

function previousMonth(value: string) {
  const [year, month] = value.split("-").map(Number)
  const start = new Date(Date.UTC(year, month - 2, 1, 12))
  const end = new Date(Date.UTC(year, month - 1, 0, 12))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function deltaLabel(value: number | null) {
  if (value === null) return "sem base anterior"
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${value.toFixed(1)}% vs. período anterior`
}

function Delta({ value, positiveIsGood = true }: { value: number | null; positiveIsGood?: boolean }) {
  if (value === null) return <span className="text-xs font-bold text-gray-400">sem base anterior</span>
  const good = positiveIsGood ? value >= 0 : value <= 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-black ${good ? "text-emerald-700" : "text-red-600"}`}>
      {value >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {deltaLabel(value)}
    </span>
  )
}

export function DrePanel({ timeZone }: { timeZone: string }) {
  const today = useMemo(() => zonedDateString(new Date(), timeZone || "America/Sao_Paulo"), [timeZone])
  const [start, setStart] = useState(() => monthStart(today))
  const [end, setEnd] = useState(today)
  const [report, setReport] = useState<DreReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const load = useCallback(async (nextStart = start, nextEnd = end) => {
    setLoading(true)
    setMessage("")
    try {
      const response = await fetch(`/api/admin/dre?start=${encodeURIComponent(nextStart)}&end=${encodeURIComponent(nextEnd)}`, { cache: "no-store" })
      const data = (await response.json()) as DreReport & { error?: string }
      if (!response.ok) throw new Error(data.error || "Não foi possível calcular a DRE.")
      setReport(data)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar DRE.")
    } finally {
      setLoading(false)
    }
  }, [start, end])

  useEffect(() => {
    void load(monthStart(today), today)
  }, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyPeriod(nextStart: string, nextEnd: string) {
    setStart(nextStart)
    setEnd(nextEnd)
    void load(nextStart, nextEnd)
  }

  function exportCsv() {
    if (!report) return
    const rows: Array<Array<string | number>> = [
      ["DRE GERENCIAL", `${report.period.start} a ${report.period.end}`],
      ["Regime", "Competência gerencial"],
      [],
      ["Linha", "Valor"],
      ["Vendas de produtos", report.revenue.productSales.toFixed(2)],
      ["Receita de entrega", report.revenue.deliveryRevenue.toFixed(2)],
      ["Receita bruta", report.revenue.grossRevenue.toFixed(2)],
      ["(-) Descontos", report.revenue.discounts.toFixed(2)],
      ["Receita líquida de vendas", report.revenue.netSales.toFixed(2)],
      ["(+) Outras receitas", report.revenue.otherIncome.toFixed(2)],
      ["Receita líquida total", report.revenue.netRevenue.toFixed(2)],
      ["(-) CMV", report.costs.cmv.toFixed(2)],
      ["Lucro bruto", report.result.grossProfit.toFixed(2)],
      ...report.expenses.map((group) => [`(-) ${group.label}`, group.amount.toFixed(2)]),
      ["Despesas operacionais", report.result.operatingExpenses.toFixed(2)],
      ["Resultado líquido gerencial", report.result.netResult.toFixed(2)],
      [],
      ["Margem bruta", `${report.result.grossMarginPercent.toFixed(2)}%`],
      ["Margem líquida", `${report.result.netMarginPercent.toFixed(2)}%`],
      ["CMV sobre receita", `${report.result.cmvPercent.toFixed(2)}%`],
      ["Ticket médio", report.result.averageTicket.toFixed(2)],
      ["Pedidos", report.result.orderCount],
      [],
      ["Data", "Receita líquida", "Outras receitas", "CMV", "Despesas", "Resultado"],
      ...report.daily.map((day) => [day.date, day.netSales.toFixed(2), day.otherIncome.toFixed(2), day.cmv.toFixed(2), day.expenses.toFixed(2), day.netResult.toFixed(2)]),
    ]
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";"))
      .join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `dre-${report.period.start}-a-${report.period.end}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const maxDaily = useMemo(() => {
    if (!report?.daily.length) return 1
    return Math.max(1, ...report.daily.map((day) => Math.max(day.netSales + day.otherIncome, Math.abs(day.netResult))))
  }, [report])

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Financeiro</p>
            <div className="mt-1 flex items-center gap-1.5"><h2 className="text-xl font-black text-gray-950">DRE gerencial</h2><HelpTip helpKey="dre.overview" /></div>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
              Resultado por competência: vendas não canceladas entram automaticamente, o CMV vem das baixas de ingredientes e os lançamentos manuais alimentam outras receitas e despesas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => applyPeriod(today, today)} className="h-9 rounded-xl border border-gray-200 px-3 text-xs font-black text-gray-700 hover:bg-gray-50">Hoje</button>
            <button onClick={() => applyPeriod(addDays(today, -6), today)} className="h-9 rounded-xl border border-gray-200 px-3 text-xs font-black text-gray-700 hover:bg-gray-50">7 dias</button>
            <button onClick={() => applyPeriod(monthStart(today), today)} className="h-9 rounded-xl border border-gray-200 px-3 text-xs font-black text-gray-700 hover:bg-gray-50">Este mês</button>
            <button onClick={() => { const period = previousMonth(today); applyPeriod(period.start, period.end) }} className="h-9 rounded-xl border border-gray-200 px-3 text-xs font-black text-gray-700 hover:bg-gray-50">Mês anterior</button>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="grid gap-1 text-xs font-bold text-gray-600">De<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="h-10 rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-900" /></label>
          <label className="grid gap-1 text-xs font-bold text-gray-600">Até<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="h-10 rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-900" /></label>
          <button disabled={loading} onClick={() => void load()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-black text-white disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</button>
          <button disabled={!report} onClick={exportCsv} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-black text-gray-700 disabled:opacity-50"><Download className="h-4 w-4" />Exportar CSV</button>
        </div>
        {message && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{message}</p>}
      </section>

      {loading && !report && <section className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm font-bold text-gray-500 shadow-sm">Calculando DRE...</section>}

      {report && (
        <>
          {!report.dataQuality.cmvComplete && (
            <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm">
              <p className="font-black">CMV ainda parcial · cobertura {report.dataQuality.cmvCoveragePercent.toFixed(1)}%</p>
              <p className="mt-1 text-sm text-amber-800">{report.dataQuality.note}</p>
            </section>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-500"><HelpLabel helpKey="dre.netRevenue">Receita líquida</HelpLabel></p><p className="mt-2 text-2xl font-black text-gray-950">{money(report.revenue.netRevenue)}</p><div className="mt-2"><Delta value={report.comparison?.deltas.netRevenuePercent ?? null} /></div></article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-500"><HelpLabel helpKey="dre.cmv">CMV</HelpLabel></p><p className="mt-2 text-2xl font-black text-red-700">{money(report.costs.cmv)}</p><p className="mt-2 text-xs font-bold text-gray-500">{report.result.cmvPercent.toFixed(1)}% da receita</p></article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-500"><HelpLabel helpKey="dre.grossProfit">Lucro bruto</HelpLabel></p><p className="mt-2 text-2xl font-black text-emerald-700">{money(report.result.grossProfit)}</p><div className="mt-2"><Delta value={report.comparison?.deltas.grossProfitPercent ?? null} /></div></article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-500"><HelpLabel helpKey="dre.netResult">Resultado líquido</HelpLabel></p><p className={`mt-2 text-2xl font-black ${report.result.netResult >= 0 ? "text-violet-700" : "text-red-700"}`}>{money(report.result.netResult)}</p><div className="mt-2"><Delta value={report.comparison?.deltas.netResultPercent ?? null} /></div></article>
          </section>

          <div className="grid gap-5 2xl:grid-cols-[1.15fr_.85fr]">
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-black text-gray-950">Demonstrativo do resultado</h3><p className="text-sm text-gray-500">{shortDate(report.period.start)} a {shortDate(report.period.end)} · {report.period.timeZone}</p></div>
              <div className="divide-y divide-gray-100 text-sm">
                <DreLine label="Vendas de produtos" value={report.revenue.productSales} />
                <DreLine label="Receita de entrega" value={report.revenue.deliveryRevenue} />
                <DreLine label="Receita bruta" value={report.revenue.grossRevenue} strong />
                <DreLine label="(-) Descontos e cupons" value={-report.revenue.discounts} negative />
                <DreLine label="Receita líquida de vendas" value={report.revenue.netSales} strong />
                <DreLine label="(+) Outras receitas" value={report.revenue.otherIncome} />
                <DreLine label="Receita líquida total" value={report.revenue.netRevenue} strong accent />
                <DreLine label="(-) CMV · ingredientes consumidos" value={-report.costs.cmv} negative />
                <DreLine label="Lucro bruto" value={report.result.grossProfit} strong accent />
                {report.expenses.map((group) => <DreLine key={group.key} label={`(-) ${group.label}`} value={-group.amount} negative />)}
                <DreLine label="Despesas operacionais" value={-report.result.operatingExpenses} strong negative />
                <DreLine label="Resultado líquido gerencial" value={report.result.netResult} strong accent />
              </div>
            </section>

            <div className="space-y-5">
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="font-black text-gray-950">Indicadores</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="Margem bruta" value={`${report.result.grossMarginPercent.toFixed(1)}%`} helpKey="dre.grossMargin" />
                  <Metric label="Margem líquida" value={`${report.result.netMarginPercent.toFixed(1)}%`} helpKey="dre.netMargin" />
                  <Metric label="Ticket médio" value={money(report.result.averageTicket)} helpKey="dre.averageTicket" />
                  <Metric label="Pedidos" value={String(report.result.orderCount)} />
                  <Metric label="Recebido" value={money(report.revenue.paidSales)} />
                  <Metric label="A receber" value={money(report.revenue.unpaidSales)} />
                </div>
                {report.revenue.cancelledOrders > 0 && <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">Cancelados no período: <strong>{report.revenue.cancelledOrders}</strong> · {money(report.revenue.cancelledAmount)}. Eles não entram na receita nem no CMV da DRE.</p>}
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="font-black text-gray-950">Despesas por grupo</h3>
                <div className="mt-3 space-y-2">
                  {report.expenses.length ? report.expenses.map((group) => (
                    <div key={group.key} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2"><span className="text-sm font-semibold text-gray-600">{group.label}</span><strong className="text-sm text-gray-950">{money(group.amount)}</strong></div>
                  )) : <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">Nenhuma despesa registrada no período.</p>}
                </div>
              </section>
            </div>
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black text-gray-950">Resultado diário</h3><p className="text-sm text-gray-500">Receita versus resultado líquido ao longo do período.</p></div><p className="text-xs font-bold text-gray-400">Regime: competência gerencial</p></div>
            <div className="mt-5 space-y-2">
              {report.daily.map((day) => {
                const revenue = day.netSales + day.otherIncome
                const resultWidth = Math.min(100, (Math.abs(day.netResult) / maxDaily) * 100)
                const revenueWidth = Math.min(100, (revenue / maxDaily) * 100)
                return (
                  <div key={day.date} className="grid gap-2 rounded-xl border border-gray-100 p-3 sm:grid-cols-[88px_1fr_130px] sm:items-center">
                    <span className="text-xs font-black text-gray-600">{shortDate(day.date).slice(0, 5)}</span>
                    <div className="space-y-1.5"><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${revenueWidth}%` }} /></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${day.netResult >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${resultWidth}%` }} /></div></div>
                    <div className="text-right text-xs"><p className="font-bold text-blue-700">R {money(revenue)}</p><p className={`font-black ${day.netResult >= 0 ? "text-emerald-700" : "text-red-700"}`}>L {money(day.netResult)}</p></div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <p className="font-black">Como ler esta DRE</p>
            <p className="mt-1 text-blue-800">Ela é gerencial e usa competência, não substitui a escrituração contábil/fiscal. Pedidos são receita automática; não registre a mesma venda novamente em “Lançamento financeiro”, pois isso duplicaria a receita. Use lançamentos manuais apenas para outras receitas e despesas.</p>
          </section>
        </>
      )}
    </div>
  )
}

function DreLine({ label, value, strong = false, negative = false, accent = false }: { label: string; value: number; strong?: boolean; negative?: boolean; accent?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 px-5 py-3 ${strong ? "bg-gray-50" : ""}`}><span className={`${strong ? "font-black text-gray-950" : "font-semibold text-gray-600"}`}>{label}</span><span className={`${strong ? "font-black" : "font-bold"} ${negative ? "text-red-700" : accent ? (value >= 0 ? "text-emerald-700" : "text-red-700") : "text-gray-950"}`}>{money(value)}</span></div>
}

function Metric({ label, value, helpKey }: { label: string; value: string; helpKey?: AdminHelpKey }) {
  return <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-bold text-gray-500">{helpKey ? <HelpLabel helpKey={helpKey}>{label}</HelpLabel> : label}</p><p className="mt-1 text-lg font-black text-gray-950">{value}</p></div>
}
