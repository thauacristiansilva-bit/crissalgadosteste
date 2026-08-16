"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, ReceiptText, WalletCards } from "lucide-react"
import { PdvPanel } from "@/components/admin/pdv-panel"
import { OperationalShell } from "@/components/operational/operational-shell"
import type { CashSession, Order, OrderStatus, Product, StoreSettings } from "@/lib/types"

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)

export function PdvWorkspace({
  organizationName,
  initialOrders,
  products,
  settings,
  initialCashSessions,
}: {
  organizationName: string
  initialOrders: Order[]
  products: Product[]
  settings: StoreSettings
  initialCashSessions: CashSession[]
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [cashSessions, setCashSessions] = useState(initialCashSessions)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const refresh = async () => {
      const response = await fetch("/api/dashboard", { cache: "no-store" }).catch(() => null)
      if (!response?.ok) return
      const data = (await response.json()) as {
        orders?: Order[]
        cashSessions?: CashSession[]
      }
      if (Array.isArray(data.orders)) setOrders(data.orders)
      if (Array.isArray(data.cashSessions)) setCashSessions(data.cashSessions)
    }

    const id = window.setInterval(refresh, 5000)
    return () => window.clearInterval(id)
  }, [])

  const incoming = useMemo(
    () =>
      orders
        .filter((order) => ["pending", "accepted", "preparing", "ready"].includes(order.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders],
  )

  const openCash = cashSessions.find((session) => !session.closedAt)
  const unpaid = incoming.filter((order) => order.paymentStatus === "unpaid").length

  async function patchOrder(
    orderId: number,
    patch: { status?: OrderStatus; paymentStatus?: "paid" | "unpaid" },
  ) {
    setBusyId(orderId)
    setMessage("")
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o pedido.")
      setOrders((current) => current.map((order) => order.id === data.order.id ? data.order : order))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o pedido.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <OperationalShell
      title="Caixa / PDV"
      subtitle="Tela operacional do caixa: novos pedidos, recebimento e venda pelo balcão. A cozinha e a entrega permanecem em telas próprias."
      organizationName={organizationName}
      roleLabel="Caixa / PDV"
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><ReceiptText className="h-4 w-4" />Pedidos em andamento</div>
          <p className="mt-2 text-3xl font-black">{incoming.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><WalletCards className="h-4 w-4" />Pagamentos pendentes</div>
          <p className="mt-2 text-3xl font-black">{unpaid}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><Clock3 className="h-4 w-4" />Situação do caixa</div>
          <p className={`mt-2 text-lg font-black ${openCash ? "text-emerald-700" : "text-slate-700"}`}>
            {openCash ? `Aberto · ${money(openCash.openingAmount)}` : "Sem sessão aberta"}
          </p>
        </div>
      </div>

      <PdvPanel
        products={products}
        settings={settings}
        onOrderCreated={(order) => setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)])}
      />

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Chegada de pedidos</h2>
            <p className="text-sm text-slate-500">Atualização automática a cada 5 segundos.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{incoming.length} ativos</span>
        </div>

        {message && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{message}</p>}

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {incoming.map((order) => (
            <article key={order.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-lg">{order.code}</strong>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase text-slate-600">{order.status}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{order.customer.name} · {order.type === "delivery" ? "Entrega" : "Retirada"}</p>
                  <p className="text-xs text-slate-500">{order.items.reduce((sum, item) => sum + item.quantity, 0)} itens · {money(order.total)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${order.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {order.paymentStatus === "paid" ? "Pago" : "Pendente"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {order.status === "pending" && (
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => patchOrder(order.id, { status: "accepted" })}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-blue-700 px-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />Aceitar pedido
                  </button>
                )}
                {order.paymentStatus === "unpaid" && (
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => patchOrder(order.id, { paymentStatus: "paid" })}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-700 disabled:opacity-50"
                  >
                    Marcar como pago
                  </button>
                )}
              </div>
            </article>
          ))}
          {incoming.length === 0 && (
            <div className="xl:col-span-2 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Nenhum pedido em andamento.
            </div>
          )}
        </div>
      </section>
    </OperationalShell>
  )
}
