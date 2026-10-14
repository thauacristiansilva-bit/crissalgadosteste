"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { whatsappOrderText } from "@/lib/order-summary"
import { googleReviewLink, whatsappMessageUrl, whatsappReviewText, whatsappStatusText } from "@/lib/order-contact"
import { printOrder } from "@/lib/print-order"
import { OrdersCalendar } from "@/components/admin/orders-calendar"
import { ExtraAccessPanel } from "@/components/admin/extra-access-panel"
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

// sf-orders-priority-v1: atendimento antes do histórico; sem apagar pedidos.
const ordersPriority: Record<OrderStatus, number> = {
  pending: 0, accepted: 1, preparing: 2, ready: 3, "in-route": 4, completed: 5, cancelled: 6,
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
  // sf-calendar-extra-access-20261014
  const [sfView, setSfView] = useState<"lista" | "calendario">("lista")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"all" | OrderStatus>("all")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [busyAll, setBusyAll] = useState(false)
  // sf-payment-before-accept-v1: a escolha precisa ser explícita antes de confirmar o dinheiro recebido.
  const [receivedMethods, setReceivedMethods] = useState<Record<number, "" | "pix" | "cash" | "credit" | "debit">>({})
  const [error, setError] = useState("")
  const [messageOrder, setMessageOrder] = useState<Order | null>(null)
  const [messageDraft, setMessageDraft] = useState("")
  const messageDialog = useRef<HTMLElement>(null)
  const messageTrigger = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!messageOrder) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = overflow; messageTrigger.current?.focus() }
  }, [messageOrder])
  function prepareMessage(order: Order, kind: "summary" | "status" | "review") {
    messageTrigger.current = document.activeElement as HTMLElement | null
    setMessageOrder(order)
    setMessageDraft(kind === "summary" ? whatsappOrderText(order, settings.storeName, settings.timeZone) : kind === "review" ? whatsappReviewText(order, settings.storeName, settings.googleReviewUrl) : whatsappStatusText(order, settings.storeName))
  }
  const pendingCount = orders.filter((order) => order.status === "pending" && order.paymentStatus === "paid").length
  const awaitingPaymentCount = orders.filter((order) => order.status === "pending" && order.paymentStatus !== "paid").length

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
    }).sort((a, b) => ordersPriority[a.status] - ordersPriority[b.status])
  }, [orders, search, status])

  async function patchOrder(id: number, patch: { status?: OrderStatus; paymentStatus?: PaymentStatus; paymentMethod?: Order["paymentMethod"]; paymentCardType?: "credit" | "debit"; courierId?: number; courierName?: string }) {
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
      if (patch.status === "in-route") prepareMessage(data.order, "status")
      if (patch.status === "completed" && googleReviewLink(settings.googleReviewUrl)) prepareMessage(data.order, "review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar pedido.")
    } finally {
      setBusyId(null)
    }
  }

  function confirmReceivedPayment(order: Order) {
    const choice = receivedMethods[order.id]
    if (!choice) { setError("Selecione como o pagamento foi recebido antes de confirmar."); return }
    const paymentMethod: Order["paymentMethod"] = choice === "credit" || choice === "debit" ? "card" : choice
    void patchOrder(order.id, {
      paymentStatus: "paid",
      paymentMethod,
      ...(choice === "credit" || choice === "debit" ? { paymentCardType: choice } : {}),
    })
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
    <section data-tutorial="orders-root" className="space-y-4">
      {messageOrder && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
        <section ref={messageDialog} role="dialog" aria-modal="true" aria-labelledby="order-message-title" onKeyDown={event => {
          if (event.key === "Escape") setMessageOrder(null)
          if (event.key === "Tab") {
            const nodes = messageDialog.current?.querySelectorAll<HTMLElement>('textarea, a[href], button:not(:disabled)')
            if (!nodes?.length) return
            const first = nodes[0], last = nodes[nodes.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
          }
        }} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
          <h2 id="order-message-title" className="text-lg font-black">Mensagem para {messageOrder.customer.name}</h2>
          <p className="mt-1 text-sm text-gray-500">Pedido {messageOrder.code}. Você pode ajustar o texto antes de abrir o WhatsApp. Editar esta mensagem não altera o pedido.</p>
          <label className="mt-4 block text-sm font-bold">Texto da mensagem<textarea autoFocus value={messageDraft} onChange={event => setMessageDraft(event.target.value)} rows={12} className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-sm font-normal" /></label>
          <div className="mt-4 flex flex-wrap gap-2">
            {messageDraft.trim() && whatsappMessageUrl(messageOrder.customer.phone, messageDraft) && <a href={whatsappMessageUrl(messageOrder.customer.phone, messageDraft)} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Abrir WhatsApp para enviar</a>}
            <button type="button" onClick={() => setMessageOrder(null)} className="rounded-xl border px-4 py-3 text-sm font-bold">Fechar</button>
          </div>
          <p className="mt-3 text-xs text-gray-500">O envio só acontece quando você toca em Enviar no WhatsApp.</p>
        </section>
      </div>}
      <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-3">
        <button type="button" onClick={() => setSfView("lista")} aria-pressed={sfView === "lista"} className={sfView === "lista" ? "rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white" : "rounded-lg border px-4 py-2 text-sm font-bold"}>Lista de pedidos</button>
        <button type="button" onClick={() => setSfView("calendario")} aria-pressed={sfView === "calendario"} className={sfView === "calendario" ? "rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white" : "rounded-lg border px-4 py-2 text-sm font-bold"}>Calendário</button>
      </div>
      {sfView === "calendario" && <OrdersCalendar orders={orders} timeZone={settings.timeZone || "America/Fortaleza"} />}
      {sfView === "lista" && <ExtraAccessPanel />}
      <div className={sfView === "calendario" ? "hidden" : "contents"}>
      <div data-tutorial="orders-filters" className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Pedidos</h2>
          <p className="text-sm text-gray-500">Acompanhe e atualize o fluxo dos pedidos em tempo real.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {pendingCount > 0 && (
            <button type="button" onClick={acceptAllPending} disabled={busyAll} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" />{busyAll ? "Aceitando..." : `Aceitar pagos (${pendingCount})`}
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

      <div data-tutorial="orders-acceptance" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Pagamento antes do aceite.</strong> Novos pedidos ficam aguardando. Confirme o recebimento (Pix, dinheiro, crédito ou débito) antes de aceitar ou preparar.
        {awaitingPaymentCount > 0 && <span className="ml-1 font-semibold">{awaitingPaymentCount} pedido(s) aguardando pagamento.</span>}
      </div>

      <div data-tutorial="orders-list" className="space-y-3">
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
                        href={whatsappMessageUrl(order.customer.phone, "")}
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
                        <span>{order.paymentMethod === "pix" ? "Pix" : order.paymentMethod === "cash" ? "Dinheiro" : order.paymentCardType === "credit" ? "Crédito" : order.paymentCardType === "debit" ? "Débito" : "Cartão"}</span>
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
                      disabled={busyId === order.id || order.paymentStatus !== "paid"}
                      title={order.paymentStatus === "paid" ? undefined : "Confirme primeiro o pagamento recebido."}
                      onClick={() => patchOrder(order.id, { status: actionableStatus })}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
                    >
                      {["pending", "accepted"].includes(order.status) ? <CheckCircle2 className="h-4 w-4" /> : order.status === "preparing" ? <PackageCheck className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                      {busyId === order.id ? "Salvando..." : actionLabel}
                    </button>
                  )}

                  {order.paymentStatus === "unpaid" && order.status !== "cancelled" && (
                     <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3">
                       <label className="block text-xs font-semibold text-amber-900" htmlFor={`paid-method-${order.id}`}>Como foi recebido?</label>
                       <select
                         id={`paid-method-${order.id}`}
                         aria-label="Forma de pagamento recebida"
                         value={receivedMethods[order.id] || ""}
                         onChange={(event) => setReceivedMethods(previous => ({ ...previous, [order.id]: event.target.value as "" | "pix" | "cash" | "credit" | "debit" }))}
                         disabled={busyId === order.id}
                         className="mt-2 h-10 w-full rounded-lg border border-amber-300 bg-white px-2 text-sm text-gray-900"
                       >
                         <option value="">Selecione...</option>
                         <option value="pix">Pix</option>
                         <option value="cash">Dinheiro</option>
                         <option value="credit">Cartão de crédito</option>
                         <option value="debit">Cartão de débito</option>
                       </select>
                       <button
                         type="button"
                         disabled={busyId === order.id || !receivedMethods[order.id]}
                         onClick={() => confirmReceivedPayment(order)}
                         className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                       >
                         <CheckCircle2 className="h-4 w-4" /> {busyId === order.id ? "Salvando..." : "Confirmar pagamento"}
                       </button>
                       <p className="mt-2 text-xs text-amber-800">Confirme apenas depois que o valor realmente for recebido.</p>
                     </div>
                   )}

                  <button type="button" disabled={!whatsappMessageUrl(order.customer.phone, "")} onClick={() => prepareMessage(order, "summary")} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-50"><MessageCircle className="h-4 w-4" /> Enviar pedido ao cliente</button>
                  <button type="button" disabled={!whatsappMessageUrl(order.customer.phone, "")} onClick={() => prepareMessage(order, "status")} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 text-xs font-bold text-emerald-700 disabled:opacity-50"><MessageCircle className="h-4 w-4" /> {order.status === "in-route" ? "Avisar saída para entrega" : "Avisar status ao cliente"}</button>
                  {order.status === "completed" && googleReviewLink(settings.googleReviewUrl) && (
                    <button type="button" disabled={!whatsappMessageUrl(order.customer.phone, "")} onClick={() => prepareMessage(order, "review")} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-800 disabled:opacity-50"><MessageCircle className="h-4 w-4" /> Pedir avaliação no Google</button>
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
                      onClick={() => { if (window.confirm(`Deseja cancelar o pedido ${order.code}? Ele ficará no histórico.${order.paymentStatus === "paid" ? " ATENÇÃO: pagamento recebido. Reembolso não é automático." : ""}`)) patchOrder(order.id, { status: "cancelled" }) }}
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
      </div>
    </section>
  )
}
