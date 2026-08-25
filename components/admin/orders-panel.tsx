"use client"

import { useMemo, useState } from "react"
import {
  Banknote,
  Bike,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPin,
  MessageCircle,
  Printer,
  FileText,
  Download,
  PackageCheck,
  QrCode,
  Search,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react"
import type { Courier, Order, OrderStatus, PaymentStatus, StoreSettings } from "@/lib/types"
import { printOrder } from "@/lib/print-order"
import { HelpLabel, HelpTip } from "@/components/admin/help-tip"

const statusLabels: Record<OrderStatus, string> = {
  pending: "Aguardando aceite",
  accepted: "Aceito",
  preparing: "Em preparação",
  ready: "Pronto",
  "in-route": "Em rota",
  completed: "Concluído",
  cancelled: "Cancelado",
}

const statusClasses: Record<OrderStatus, string> = {
  pending: "bg-gray-100 text-gray-700 ring-gray-200",
  accepted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  preparing: "bg-blue-50 text-blue-700 ring-blue-200",
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "in-route": "bg-violet-50 text-violet-700 ring-violet-200",
  completed: "bg-gray-100 text-gray-700 ring-gray-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
}

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "accepted",
  accepted: "preparing",
  preparing: "ready",
  ready: "in-route",
  "in-route": "completed",
}

const nextStatusLabel: Partial<Record<OrderStatus, string>> = {
  pending: "Aceitar pedido",
  accepted: "Começar preparo",
  preparing: "Marcar como pronto",
  ready: "Saiu para entrega",
  "in-route": "Concluir pedido",
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

function PaymentIcon({ method }: { method: Order["paymentMethod"] }) {
  const Icon = method === "pix" ? QrCode : method === "cash" ? Banknote : CreditCard
  return <Icon className="h-4 w-4" />
}

export function OrdersPanel({
  orders,
  couriers,
  onOrderUpdated,
  settings,
}: {
  orders: Order[]
  couriers: Courier[]
  onOrderUpdated: (order: Order) => void
  settings: StoreSettings
}) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"all" | OrderStatus>("all")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [busyAll, setBusyAll] = useState(false)
  const [error, setError] = useState("")
  const pendingCount = orders.filter((order) => order.status === "pending").length

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR")
    return orders.filter((order) => {
      const matchesStatus = status === "all" || order.status === status
      const matchesSearch =
        !query ||
        order.code.toLowerCase().includes(query) ||
        order.reference.toLowerCase().includes(query) ||
        order.customer.name.toLocaleLowerCase("pt-BR").includes(query) ||
        order.customer.phone.toLowerCase().includes(query)
      return matchesStatus && matchesSearch
    })
  }, [orders, search, status])

  async function patchOrder(id: number, patch: { status?: OrderStatus; paymentStatus?: PaymentStatus; courierId?: number; courierName?: string }) {
    setBusyId(id)
    setError("")
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o pedido.")
      onOrderUpdated(data.order)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar pedido.")
    } finally {
      setBusyId(null)
    }
  }

  async function acceptAllPending() {
    if (!pendingCount || busyAll) return
    setBusyAll(true)
    setError("")
    try {
      const response = await fetch("/api/orders/accept-pending", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível aceitar os pedidos pendentes.")
      for (const order of (data.orders || []) as Order[]) onOrderUpdated(order)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aceitar pedidos pendentes.")
    } finally {
      setBusyAll(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Pedidos</h2>
          <p className="text-sm text-gray-500">Acompanhe e atualize o fluxo dos pedidos em tempo real.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {pendingCount > 0 && (
            <button type="button" onClick={acceptAllPending} disabled={busyAll} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" />{busyAll ? "Aceitando..." : `Aceitar pendentes (${pendingCount})`}
            </button>
          )}
          <label className="relative min-w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cliente, pedido ou referência"
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | OrderStatus)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Todos os status</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className={`rounded-xl border px-4 py-3 text-sm ${settings.orderAcceptanceMode === "manual" ? "border-blue-200 bg-blue-50 text-blue-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        <strong>{settings.orderAcceptanceMode === "manual" ? "Aceite manual ativo." : "Aceite automático ativo."}</strong>{" "}
        {settings.orderAcceptanceMode === "manual" ? "Novos pedidos aguardam confirmação da equipe antes do preparo." : "Novos pedidos online já entram como aceitos."}
      </div>

      <div className="space-y-3">
        {filteredOrders.map((order) => {
          const TypeIcon = order.type === "delivery" ? Bike : ShoppingBag
          const actionableStatus: OrderStatus | undefined =
            order.status === "ready" && order.type === "pickup"
              ? "completed"
              : nextStatus[order.status]
          const actionLabel =
            order.status === "ready" && order.type === "pickup"
              ? "Concluir retirada"
              : nextStatusLabel[order.status]
          return (
            <article key={order.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 p-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-lg font-black text-gray-950">{order.code}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      <TypeIcon className="h-3.5 w-3.5" />
                      {order.type === "delivery" ? "Delivery" : "Retirada"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses[order.status]}`}>
                      {statusLabels[order.status]}
                    </span>
                    <HelpTip helpKey="orders.status" />
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">{order.channel}</span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Cliente</p>
                      <p className="mt-1 font-semibold text-gray-900">{order.customer.name}</p>
                      <a
                        href={`https://wa.me/${order.customer.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> {order.customer.phone}
                      </a>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Recebimento</p>
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-700">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                        <span>{order.customer.address}</span>
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400"><HelpLabel helpKey="orders.payment">Pagamento</HelpLabel></p>
                      <p className="mt-1 text-xl font-black text-gray-950">{formatCurrency(order.total)}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <PaymentIcon method={order.paymentMethod} />
                        <span>{order.paymentMethod === "pix" ? "PIX" : order.paymentMethod === "cash" ? "Dinheiro" : "Cartão"}</span>
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${order.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {order.paymentStatus === "paid" ? "Pago" : "Não pago"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Criado em</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <Clock3 className="h-4 w-4 text-gray-400" /> {formatDate(order.createdAt)}
                      </p>
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Receber em</p>
                      <p className="mt-1 text-sm font-black text-blue-800">{formatDate(order.requestedFor)} {order.scheduled ? "· agendado" : ""}</p>
                      <p className="mt-1 font-mono text-[11px] text-gray-400">{order.reference}</p>
                    </div>
                  </div>

                  <details className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-gray-700">Ver itens do pedido ({order.items.length})</summary>
                    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                      {order.items.map((item, index) => (
                        <div key={`${order.id}-${item.productId}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                          <div className="text-gray-600"><span><strong className="text-gray-900">{item.quantity}x</strong> {item.name}</span>{item.modifiers?.length ? <div className="mt-1 space-y-0.5 pl-4">{item.modifiers.map((modifier) => <p key={`${modifier.groupId}-${modifier.optionId}`} className="text-xs text-gray-500">+ {modifier.optionName}{modifier.included ? " · incluído" : modifier.priceDelta > 0 ? ` · + ${formatCurrency(modifier.priceDelta)}` : ""}</p>)}</div> : null}</div>
                          <span className="font-semibold text-gray-900">{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                      {order.notes && <p className="pt-2 text-xs text-gray-500"><strong>Obs.:</strong> {order.notes}</p>}
                    </div>
                  </details>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 xl:w-48 xl:flex-col">
                  {order.type === "delivery" && !["completed", "cancelled"].includes(order.status) && (
                    <label className="block w-full">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-400"><HelpLabel helpKey="orders.courier">Entregador</HelpLabel></span>
                      <select
                        value={order.courierId || ""}
                        onChange={(event) => {
                          const courier = couriers.find((item) => item.id === Number(event.target.value))
                          patchOrder(order.id, { courierId: courier?.id, courierName: courier?.name || "" })
                        }}
                        className="h-10 w-full rounded-xl border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 outline-none"
                      >
                        <option value="">Não atribuído</option>
                        {couriers.filter((courier) => courier.active).map((courier) => <option key={courier.id} value={courier.id}>{courier.name}{courier.linkedUserId ? " · app ativo" : courier.staffMemberId ? " · aguardando login" : " · sem login vinculado"}</option>)}
                      </select>
                    </label>
                  )}
                  {actionableStatus && (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => patchOrder(order.id, { status: actionableStatus })}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
                    >
                      {["pending", "accepted"].includes(order.status) ? <CheckCircle2 className="h-4 w-4" /> : order.status === "preparing" ? <PackageCheck className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                      {busyId === order.id ? "Salvando..." : actionLabel}
                    </button>
                  )}

                  {order.paymentStatus === "unpaid" && order.status !== "cancelled" && (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => patchOrder(order.id, { paymentStatus: "paid" })}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Marcar pago
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => printOrder(order, settings, "kitchen")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Printer className="h-4 w-4" /> Ticket cozinha
                  </button>

                  <button
                    type="button"
                    onClick={() => printOrder(order, settings, "customer")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <FileText className="h-4 w-4" /> Ticket cliente
                  </button>

                  <a
                    href={`/api/orders/${order.id}/ticket-pdf?mode=customer`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" /> Baixar ticket PDF
                  </a>

                  {settings.fiscalEnabled && settings.fiscalProviderUrl && (
                    <a
                      href={settings.fiscalProviderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700"
                    >
                      <FileText className="h-4 w-4" /> Emitir nota fiscal
                    </a>
                  )}

                  {!(["completed", "cancelled"] as OrderStatus[]).includes(order.status) && (
                    <>
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => patchOrder(order.id, { status: "cancelled" })}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" /> Cancelar
                    </button><HelpTip helpKey="orders.cancel" className="self-center" />
                    </>
                  )}
                </div>
              </div>
            </article>
          )
        })}

        {filteredOrders.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <PackageCheck className="mx-auto h-9 w-9 text-gray-300" />
            <h3 className="mt-3 font-semibold text-gray-800">Nenhum pedido encontrado</h3>
            <p className="mt-1 text-sm text-gray-500">Altere a busca ou o filtro de status.</p>
          </div>
        )}
      </div>
    </section>
  )
}
