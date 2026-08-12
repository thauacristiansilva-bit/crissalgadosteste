"use client"

import { useEffect, useMemo, useState } from "react"
import { ChefHat, Clock3, PackageCheck, ShoppingBag, Truck } from "lucide-react"
import type { Order, OrderStatus, StoreSettings } from "@/lib/types"
import { HelpTip } from "@/components/admin/help-tip"

const time = (value: string, timeZone: string) => new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(value))
const dateTime = (value: string, timeZone: string) => new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value))

function urgency(order: Order, now: Date, settings: StoreSettings) {
  const remaining = Math.ceil((new Date(order.requestedFor).getTime() - now.getTime()) / 60000)
  const yellowLimit = order.type === "delivery" ? settings.deliveryMaxMinutes : Math.max(settings.pickupLeadMinutes, 30)
  const redLimit = order.type === "delivery" ? settings.deliveryMinMinutes : Math.max(15, Math.floor(settings.pickupLeadMinutes / 2))
  if (remaining <= redLimit) return { remaining, label: remaining < 0 ? `${Math.abs(remaining)} min atrasado` : `${remaining} min`, card: "border-red-300 bg-red-50", badge: "bg-red-600 text-white", dot: "bg-red-500" }
  if (remaining <= yellowLimit) return { remaining, label: `${remaining} min`, card: "border-amber-300 bg-amber-50", badge: "bg-amber-500 text-white", dot: "bg-amber-500" }
  return { remaining, label: `${remaining} min`, card: "border-emerald-200 bg-emerald-50/50", badge: "bg-emerald-600 text-white", dot: "bg-emerald-500" }
}

const statusLabel: Partial<Record<OrderStatus, string>> = {
  pending: "Legado / pendente",
  accepted: "Aceito automaticamente",
  preparing: "Em preparo",
  ready: "Pronto",
}

export function KitchenPanel({ orders, settings, onOrderUpdated }: { orders: Order[]; settings: StoreSettings; onOrderUpdated: (order: Order) => void }) {
  const timeZone = settings.timeZone || "America/Sao_Paulo"
  const [now, setNow] = useState(new Date())
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const active = useMemo(
    () => orders
      .filter((order) => ["pending", "accepted", "preparing", "ready"].includes(order.status))
      .sort((a, b) => new Date(a.requestedFor).getTime() - new Date(b.requestedFor).getTime()),
    [orders],
  )

  async function patch(id: number, status: OrderStatus) {
    setBusyId(id)
    try {
      const response = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
      const data = await response.json()
      if (response.ok) onOrderUpdated(data.order)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><ChefHat className="h-5 w-5" /></div>
          <div><div className="flex items-center gap-1.5"><h2 className="text-lg font-bold text-gray-900">Cozinha · fila por horário</h2><HelpTip helpKey="kitchen.flow" /></div><p className="text-sm text-gray-500">Os pedidos com recebimento mais próximo aparecem primeiro.</p></div>
        </div>
        <div className="rounded-2xl bg-slate-950 px-5 py-3 text-white shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Relógio da cozinha</p>
          <p className="mt-1 font-mono text-2xl font-black tabular-nums">{new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now)}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /><strong>Verde:</strong> horário confortável</div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /><strong>Amarelo:</strong> atenção ao prazo</div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red-500" /><strong>Vermelho:</strong> prioridade imediata</div>
      </div>

      <div className="space-y-3">
        {active.map((order, index) => {
          const alert = urgency(order, now, settings)
          const TypeIcon = order.type === "delivery" ? Truck : ShoppingBag
          const next: OrderStatus | null = order.status === "pending" ? "accepted" : order.status === "accepted" ? "preparing" : order.status === "preparing" ? "ready" : null
          const action = order.status === "pending" ? "Aceitar legado" : order.status === "accepted" ? "Começar preparo" : order.status === "preparing" ? "Marcar pronto" : ""
          return (
            <article key={order.id} className={`overflow-hidden rounded-2xl border-2 shadow-sm transition ${alert.card}`}>
              <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start">
                <div className="flex items-center gap-3 lg:w-44">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-black ${alert.badge}`}>{index + 1}</div>
                  <div><p className="text-xl font-black text-gray-950">{order.code}</p><p className="text-xs font-bold text-gray-500">{statusLabel[order.status] || order.status}</p></div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-gray-700"><TypeIcon className="h-3.5 w-3.5" />{order.type === "delivery" ? "Delivery" : "Retirada"}</span>
                    {order.scheduled && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">Agendado</span>}
                    {order.deliveryZoneName && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{order.deliveryZoneName}</span>}
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Receber às</p><p className="mt-1 text-2xl font-black text-gray-950">{time(order.requestedFor, timeZone)}</p><p className="text-xs font-medium text-gray-500">{dateTime(order.requestedFor, timeZone)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tempo restante</p><p className="mt-1 text-2xl font-black text-gray-950">{alert.label}</p><p className="text-xs text-gray-500">Pedido entrou às {time(order.createdAt, timeZone)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Cliente</p><p className="mt-1 font-black text-gray-900">{order.customer.name}</p><p className="text-xs text-gray-500">{order.customer.phone}</p></div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {order.items.map((item, itemIndex) => <div key={`${item.productId}-${itemIndex}`} className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-sm"><div><strong className="mr-2 text-blue-700">{item.quantity}x</strong><span className="font-semibold text-gray-800">{item.name}</span></div>{item.modifiers?.length ? <div className="mt-1 space-y-0.5 pl-7">{item.modifiers.map((modifier) => <p key={`${modifier.groupId}-${modifier.optionId}`} className="text-[11px] font-semibold text-gray-500">+ {modifier.optionName}</p>)}</div> : null}</div>)}
                  </div>
                  {order.notes && <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-amber-900"><strong>Obs.:</strong> {order.notes}</p>}
                </div>

                <div className="flex shrink-0 gap-2 lg:w-44 lg:flex-col">
                  {next && <button disabled={busyId === order.id} onClick={() => patch(order.id, next)} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"><PackageCheck className="h-4 w-4" />{busyId === order.id ? "Salvando..." : action}</button>}
                  {order.status === "ready" && <div className="flex h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3 text-sm font-black text-white">✓ Pronto</div>}
                </div>
              </div>
            </article>
          )
        })}
        {active.length === 0 && <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center"><Clock3 className="mx-auto h-10 w-10 text-gray-300" /><h3 className="mt-3 font-bold text-gray-800">Fila vazia</h3><p className="mt-1 text-sm text-gray-500">Os próximos pedidos aparecerão aqui automaticamente.</p></div>}
      </div>
    </section>
  )
}
