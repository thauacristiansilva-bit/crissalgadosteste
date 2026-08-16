"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, MapPin, Navigation, PackageCheck, Phone, Truck } from "lucide-react"
import { OperationalShell } from "@/components/operational/operational-shell"
import type { Order, OrderStatus } from "@/lib/types"

function address(order: Order) {
  return [
    order.customer.address,
    order.customer.number,
    order.customer.district,
    order.customer.city,
  ].filter(Boolean).join(", ")
}

export function CourierWorkspace({
  organizationName,
  initialOrders,
}: {
  organizationName: string
  initialOrders: Order[]
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const refresh = async () => {
      const response = await fetch("/api/dashboard", { cache: "no-store" }).catch(() => null)
      if (!response?.ok) return
      const data = (await response.json()) as { orders?: Order[] }
      if (Array.isArray(data.orders)) setOrders(data.orders)
    }

    const id = window.setInterval(refresh, 5000)
    return () => window.clearInterval(id)
  }, [])

  const deliveries = useMemo(
    () => orders
      .filter((order) => order.type === "delivery" && ["ready", "in-route"].includes(order.status))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "in-route" ? -1 : 1
        return new Date(a.requestedFor).getTime() - new Date(b.requestedFor).getTime()
      }),
    [orders],
  )

  async function patchStatus(orderId: number, status: OrderStatus) {
    setBusyId(orderId)
    setMessage("")
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar a entrega.")
      setOrders((current) => current.map((order) => order.id === data.order.id ? data.order : order))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a entrega.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <OperationalShell
      title="Entregas"
      subtitle="Tela móvel do entregador. Nesta fase ela recebe entregas prontas e registra saída/conclusão. GPS, roteirização e vínculo individual de entregador entram nas próximas fases de entrega."
      organizationName={organizationName}
      roleLabel="Entregador"
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><PackageCheck className="h-4 w-4" />Prontas para sair</div>
          <p className="mt-2 text-3xl font-black">{deliveries.filter((order) => order.status === "ready").length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><Truck className="h-4 w-4" />Em rota</div>
          <p className="mt-2 text-3xl font-black">{deliveries.filter((order) => order.status === "in-route").length}</p>
        </div>
      </div>

      {message && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {deliveries.map((order) => {
          const destination = address(order)
          const mapsHref = destination
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
            : null
          return (
            <article key={order.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${order.status === "in-route" ? "border-blue-300" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-xl">{order.code}</strong>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${order.status === "in-route" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {order.status === "in-route" ? "Em rota" : "Pronto"}
                    </span>
                  </div>
                  {order.courierName && <p className="mt-1 text-xs font-bold text-slate-500">Atribuído: {order.courierName}</p>}
                </div>
                <Navigation className="h-5 w-5 text-blue-700" />
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p className="font-black text-slate-900">{order.customer.name}</p>
                <p className="flex items-start gap-2 text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{destination || "Endereço não informado"}</p>
                {order.customer.phone && <p className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4" />{order.customer.phone}</p>}
                {order.notes && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"><strong>Obs.:</strong> {order.notes}</p>}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700">
                    <MapPin className="h-4 w-4" />Abrir endereço
                  </a>
                )}
                {order.status === "ready" && (
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => patchStatus(order.id, "in-route")}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Truck className="h-4 w-4" />Iniciar entrega
                  </button>
                )}
                {order.status === "in-route" && (
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => patchStatus(order.id, "completed")}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />Finalizar entrega
                  </button>
                )}
              </div>
            </article>
          )
        })}

        {deliveries.length === 0 && (
          <div className="lg:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Truck className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 font-black">Nenhuma entrega disponível</h2>
            <p className="mt-1 text-sm text-slate-500">Pedidos prontos para delivery aparecerão aqui automaticamente.</p>
          </div>
        )}
      </div>
    </OperationalShell>
  )
}
