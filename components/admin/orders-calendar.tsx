"use client"

import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react"
import type { Order, OrderStatus } from "@/lib/types"

type CalendarMode = "scheduled" | "created"
const labels: Record<OrderStatus, string> = {
  pending: "Aguardando aceite", accepted: "Aceito", preparing: "Em preparo",
  ready: "Pronto", "in-route": "Em rota", completed: "Concluído", cancelled: "Cancelado",
}
const money = (value: number) => new Intl.NumberFormat("pt-BR", {style: "currency", currency: "BRL"}).format(value)

// Usa a data da EMPRESA para que a virada do dia em UTC não mova o agendamento.
export function localDay(isoValue: string, timeZone: string) {
  const date = new Date(isoValue)
  if (!Number.isFinite(date.getTime())) return ""
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date)
    const value = (key: string) => parts.find((part) => part.type === key)?.value || ""
    return `${value("year")}-${value("month")}-${value("day")}`
  } catch { // Caso o fuso cadastrado esteja incorreto.
    return date.toISOString().slice(0, 10)
  }
}

const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export function OrdersCalendar({orders, timeZone}: {orders: Order[], timeZone: string}) {
  const today = localDay(new Date().toISOString(), timeZone)
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [chosen, setChosen] = useState(() => today)
  const [mode, setMode] = useState<CalendarMode>("scheduled")
  const [showCancelled, setShowCancelled] = useState(false)
  const [showCompleted, setShowCompleted] = useState(true)
  const filtered = useMemo(() => orders.filter((order) =>
    (showCancelled || order.status !== "cancelled") && (showCompleted || order.status !== "completed")),
  [orders, showCancelled, showCompleted])
  const byDay = useMemo(() => {
    const map = new Map<string, Order[]>()
    for (const order of filtered) {
      const key = localDay(mode === "scheduled" ? order.requestedFor : order.createdAt, timeZone)
      if (!key) continue
      const items = map.get(key) || []
      items.push(order)
      map.set(key, items)
    }
    for (const items of map.values()) items.sort((a, b) =>
      new Date(mode === "scheduled" ? a.requestedFor : a.createdAt).getTime() -
      new Date(mode === "scheduled" ? b.requestedFor : b.createdAt).getTime())
    return map
  }, [filtered, mode, timeZone])

  const [year, numericMonth] = month.split("-").map(Number)
  const firstDay = new Date(Date.UTC(year, numericMonth - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, numericMonth, 0)).getUTCDate()
  const grid = Array.from({length: Math.ceil((firstDay + daysInMonth) / 7) * 7}, (_, i) => {
    const day = i - firstDay + 1
    return day > 0 && day <= daysInMonth ? `${month}-${String(day).padStart(2, "0")}` : null
  })
  const chosenOrders = byDay.get(chosen) || []
  const monthCount = [...byDay].filter(([day]) => day.startsWith(month)).reduce((sum, [, values]) => sum + values.length, 0)
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {timeZone: "UTC", month: "long", year: "numeric"}).format(new Date(Date.UTC(year, numericMonth - 1, 1)))

  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(year, numericMonth - 1 + delta, 1))
    const next = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    setMonth(next)
    setChosen(`${next}-01`)
  }
  function showMonthOfToday() {
    setMonth(today.slice(0, 7)); setChosen(today)
  }
  function switchMode(next: CalendarMode) { setMode(next) }

  return (
    <div className="space-y-4" data-sf-calendar="v1">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900"><CalendarDays className="h-5 w-5 text-orange-600"/> Calendário de pedidos</h3>
          <p className="text-sm text-gray-500">{monthCount} pedido(s) no mês · clique em um dia para abrir todos</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => switchMode("scheduled")} aria-pressed={mode === "scheduled"} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${mode === "scheduled" ? "border-orange-300 bg-orange-50 text-orange-800" : "border-gray-200 text-gray-600"}`}>Entrega / retirada</button>
          <button type="button" onClick={() => switchMode("created")} aria-pressed={mode === "created"} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${mode === "created" ? "border-orange-300 bg-orange-50 text-orange-800" : "border-gray-200 text-gray-600"}`}>Data da compra</button>
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mês anterior" className="rounded-lg border p-2 hover:bg-gray-50"><ChevronLeft className="h-5 w-5"/></button>
          <div className="text-center"><h4 className="text-base font-black capitalize text-gray-900">{monthLabel}</h4><button type="button" onClick={showMonthOfToday} className="text-xs font-semibold text-blue-700 hover:underline">Voltar para hoje</button></div>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Próximo mês" className="rounded-lg border p-2 hover:bg-gray-50"><ChevronRight className="h-5 w-5"/></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">{daysOfWeek.map((day) => <div key={day} className="py-1 text-[11px] font-bold text-gray-500 sm:text-xs">{day}</div>)}
          {grid.map((date, i) => date ? (
            <button key={date} type="button" onClick={() => setChosen(date)} aria-label={`${date}: ${(byDay.get(date) || []).length} pedidos`} aria-pressed={chosen === date} className={`min-h-16 rounded-lg border px-1 py-2 text-center sm:min-h-20 ${chosen === date ? "border-orange-500 bg-orange-50" : date === today ? "border-blue-300 bg-blue-50" : "border-gray-100 hover:bg-gray-50"}`}>
              <span className="text-sm font-bold text-gray-800">{Number(date.slice(-2))}</span>
              {(byDay.get(date) || []).length > 0 && <span className="mx-auto mt-1 block w-fit rounded-full bg-blue-700 px-1.5 py-0.5 text-[10px] font-bold text-white sm:px-2 sm:text-xs">{(byDay.get(date) || []).length} pedido(s)</span>}
            </button>
          ) : <span key={`empty-${i}`} aria-hidden="true" />)}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 border-t pt-3 text-sm text-gray-600">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)}/> Concluídos</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)}/> Cancelados</label>
        </div>
      </div>
      <section aria-live="polite" className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <h4 className="font-black text-gray-900">{chosen.split("-").reverse().join("/")} — {chosenOrders.length} pedido(s)</h4>
        {chosenOrders.length === 0 && <p className="text-sm text-gray-500">Nenhum pedido para esta data com os filtros atuais.</p>}
        {chosenOrders.map((order) => <details key={order.id} className="rounded-xl border border-gray-200 p-3 open:border-orange-200">
          <summary className="cursor-pointer list-none space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">{order.code} · {order.customer.name}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{labels[order.status]}</span></div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600"><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {new Date(order.requestedFor).toLocaleString("pt-BR", {timeZone, hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}</span><span>{order.type === "delivery" ? "Entrega" : "Retirada"}</span><span>{order.items.reduce((n, item) => n + item.quantity, 0)} unidades</span><span className="font-bold text-gray-900">{money(order.total)}</span></div>
          </summary>
          <div className="mt-3 space-y-2 border-t pt-3 text-sm">
            <p><strong>Contato:</strong> {order.customer.phone}</p>
            {order.type === "delivery" && <p><strong>Endereço:</strong> {order.customer.address || ""}{order.customer.number ? `, ${order.customer.number}` : ""}</p>}
            <p><strong>Pagamento:</strong> {order.paymentStatus === "paid" ? "Pago" : "Pendente"}</p>
            {order.items.map((item, index) => <div key={index} className="rounded-lg bg-gray-50 px-3 py-2"><p className="font-semibold">{item.quantity}x {item.name} — {money(item.subtotal)}</p>{item.modifiers?.map((modifier, idx) => <p className="pl-3 text-xs text-gray-600" key={idx}>+ {modifier.optionName}</p>)}</div>)}
            {order.notes && <p><strong>Observação:</strong> {order.notes}</p>}
          </div>
        </details>)}
      </section>
    </div>
  )
}
