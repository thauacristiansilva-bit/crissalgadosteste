"use client"

import { FormEvent, useMemo, useState } from "react"
import { Banknote, Download, LockKeyhole, Plus, TrendingDown, TrendingUp, UnlockKeyhole } from "lucide-react"
import type { CashSession, FinancialEntry, Order, StoreSettings } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))

export function SalesPanel({ orders, settings, initialCashSessions, initialEntries }: { orders: Order[]; settings: StoreSettings; initialCashSessions: CashSession[]; initialEntries: FinancialEntry[] }) {
  const [cashSessions, setCashSessions] = useState(initialCashSessions)
  const [entries, setEntries] = useState(initialEntries)
  const [cashAmount, setCashAmount] = useState("0")
  const [entryType, setEntryType] = useState<"income" | "expense">("expense")
  const [entryCategory, setEntryCategory] = useState("Geral")
  const [entryDescription, setEntryDescription] = useState("")
  const [entryAmount, setEntryAmount] = useState("")
  const [message, setMessage] = useState("")
  const openCash = cashSessions.find((item) => !item.closedAt)
  const validOrders = orders.filter((order) => order.status !== "cancelled")
  const revenue = validOrders.reduce((sum, order) => sum + order.total, 0)
  const paid = validOrders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0)
  const expenses = entries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0)
  const incomes = entries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0)
  const net = paid + incomes - expenses

  const daily = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>()
    validOrders.forEach((order) => { const key = new Date(order.createdAt).toLocaleDateString("pt-BR"); const current = map.get(key) || { orders: 0, revenue: 0 }; current.orders += 1; current.revenue += order.total; map.set(key, current) })
    return [...map.entries()].slice(-14).reverse()
  }, [orders])

  async function cashAction(action: "open" | "close") {
    setMessage("")
    const response = await fetch("/api/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "open" ? { action, amount: Number(cashAmount || 0) } : { action, id: openCash?.id, amount: Number(cashAmount || 0) }) })
    const data = await response.json(); if (!response.ok) return setMessage(data.error || "Erro no caixa.")
    const refresh = await fetch("/api/cash").then((r) => r.json()); setCashSessions(refresh.sessions || []); setCashAmount("0"); setMessage(action === "open" ? "Caixa aberto." : "Caixa fechado.")
  }

  async function addEntry(event: FormEvent) {
    event.preventDefault(); const response = await fetch("/api/financial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: entryType, category: entryCategory, description: entryDescription, amount: Number(entryAmount.replace(",", ".")) }) }); const data = await response.json(); if (!response.ok) return setMessage(data.error || "Erro no lançamento."); setEntries([data.entry, ...entries]); setEntryDescription(""); setEntryAmount(""); setMessage("Lançamento salvo.")
  }

  function exportCsv() {
    const rows = [["pedido","data","cliente","tipo","status","pagamento","total"], ...orders.map((order) => [order.code, order.createdAt, order.customer.name, order.type, order.status, order.paymentStatus, order.total.toFixed(2)])]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(";")).join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `vendas-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Vendas", money(revenue), TrendingUp, "bg-blue-50 text-blue-700"], ["Recebido", money(paid), Banknote, "bg-emerald-50 text-emerald-700"], ["Despesas", money(expenses), TrendingDown, "bg-red-50 text-red-700"], ["Saldo operacional", money(net), TrendingUp, "bg-violet-50 text-violet-700"],
    ].map(([label, value, Icon, cls]: any) => <article key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><div><p className="text-sm font-semibold text-gray-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div><div className={`rounded-xl p-2.5 ${cls}`}><Icon className="h-5 w-5"/></div></div></article>)}</section>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-black">Caixa</h2><p className="text-sm text-gray-500">Abertura e fechamento do turno.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${openCash ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{openCash ? "ABERTO" : "FECHADO"}</span></div><div className="mt-4 flex gap-2"><input type="number" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-sm" placeholder={openCash ? "Valor contado no fechamento" : "Troco inicial"}/><button onClick={() => cashAction(openCash ? "close" : "open")} className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black text-white ${openCash ? "bg-red-600" : "bg-blue-700"}`}>{openCash ? <LockKeyhole className="h-4 w-4"/> : <UnlockKeyhole className="h-4 w-4"/>}{openCash ? "Fechar caixa" : "Abrir caixa"}</button></div>{openCash && <p className="mt-3 text-xs text-gray-500">Aberto em {date(openCash.openedAt)} · fundo {money(openCash.openingAmount)}</p>}{message && <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{message}</p>}</section>

      <form onSubmit={addEntry} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="font-black">Lançamento financeiro</h2><p className="text-sm text-gray-500">Registre despesas e receitas fora dos pedidos.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={entryType} onChange={(e) => setEntryType(e.target.value as any)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"><option value="expense">Despesa</option><option value="income">Receita</option></select><input value={entryCategory} onChange={(e) => setEntryCategory(e.target.value)} className="h-10 rounded-xl border border-gray-200 px-3 text-sm" placeholder="Categoria"/><input required value={entryDescription} onChange={(e) => setEntryDescription(e.target.value)} className="h-10 rounded-xl border border-gray-200 px-3 text-sm sm:col-span-2" placeholder="Descrição"/><input required value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} inputMode="decimal" className="h-10 rounded-xl border border-gray-200 px-3 text-sm" placeholder="Valor"/><button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-black text-white"><Plus className="h-4 w-4"/>Salvar</button></div></form>
    </div>

    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="font-black">Histórico e relatórios</h2><p className="text-sm text-gray-500">Resumo por dia e exportação para Excel/CSV.</p></div><button onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-black text-gray-700"><Download className="h-4 w-4"/>Exportar CSV</button></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Data</th><th className="px-5 py-3">Pedidos</th><th className="px-5 py-3">Faturamento</th></tr></thead><tbody className="divide-y divide-gray-100">{daily.map(([day, info]) => <tr key={day}><td className="px-5 py-3 font-bold">{day}</td><td className="px-5 py-3">{info.orders}</td><td className="px-5 py-3 font-black">{money(info.revenue)}</td></tr>)}</tbody></table></div></section>
  </div>
}
