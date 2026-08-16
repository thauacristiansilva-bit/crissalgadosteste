"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChefHat, Clock3, ExternalLink, Home, MapPin, MessageCircle, Navigation, PackageCheck, ShieldCheck, Star, Truck } from "lucide-react"
import type { Order, StoreSettings } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
const statusLabel: Record<Order["status"], string> = { pending: "Pedido recebido", accepted: "Pedido aceito", preparing: "Em preparação", ready: "Pedido pronto", "in-route": "Saiu para entrega", completed: "Concluído", cancelled: "Cancelado" }
const reactions = ["😞", "🙁", "😐", "🙂", "😍"]

type DeliveryTracking = {
  enabled: boolean
  state:
    | "disabled"
    | "preparing"
    | "waiting-courier"
    | "waiting-departure"
    | "other-delivery"
    | "active"
    | "active-location-pending"
    | "completed"
    | "cancelled"
  message: string
  courierName?: string
  location?: {
    latitude: number
    longitude: number
    accuracyMeters: number | null
    updatedAt: string
  }
}

function liveMapUrl(latitude: number, longitude: number) {
  const delta = 0.007
  const left = longitude - delta
  const right = longitude + delta
  const bottom = latitude - delta
  const top = latitude + delta
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${left},${bottom},${right},${top}`)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`
}

export function OrderTracker({ initialOrder, settings, storePath = "/" }: { initialOrder: Order; settings: StoreSettings; storePath?: string }) {
  const [order, setOrder] = useState(initialOrder)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackError, setFeedbackError] = useState("")
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const [tracking, setTracking] = useState<DeliveryTracking | null>(null)

  useEffect(() => {
    let disposed = false

    const refresh = async () => {
      const response = await fetch(
        `/api/order-status/${encodeURIComponent(order.reference)}`,
        { cache: "no-store" },
      ).catch(() => null)

      if (!response?.ok || disposed) return
      const data = (await response.json()) as {
        order?: Order
        tracking?: DeliveryTracking
      }
      if (data.order) setOrder(data.order)
      if (data.tracking) setTracking(data.tracking)
    }

    void refresh()
    if (["completed", "cancelled"].includes(order.status)) {
      return () => { disposed = true }
    }

    const id = window.setInterval(refresh, 5000)
    return () => {
      disposed = true
      window.clearInterval(id)
    }
  }, [order.reference, order.status])

  const steps = useMemo(() => { const base = [{ key: "accepted", label: "Aceito", icon: Clock3 }, { key: "preparing", label: "Preparando", icon: ChefHat }, { key: "ready", label: "Pronto", icon: PackageCheck }]; if (order.type === "delivery") base.push({ key: "in-route", label: "Em rota", icon: Truck }); base.push({ key: "completed", label: order.type === "delivery" ? "Entregue" : "Retirado", icon: CheckCircle2 }); return base }, [order.type])
  const activeIndex = steps.findIndex((step) => step.key === order.status)
  const whatsappMessage = encodeURIComponent(`Olá! Quero falar sobre o pedido ${order.reference} (${order.code}).`)

  async function sendFeedback() {
    setFeedbackBusy(true); setFeedbackError("")
    try { const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderReference: order.reference, rating, comment }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível enviar a avaliação."); setFeedbackSent(true) } catch (error) { setFeedbackError(error instanceof Error ? error.message : "Erro ao avaliar.") } finally { setFeedbackBusy(false) }
  }

  return (
    <main className="min-h-screen px-4 py-6 text-gray-950 sm:px-6" style={{ backgroundColor: settings.backgroundColor }}>
      <div className="mx-auto max-w-3xl">
        <a href={storePath} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-orange-600"><Home className="h-4 w-4" />Voltar ao cardápio</a>
        <section className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-xl">
          <div className="p-6 text-white sm:p-8" style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})` }}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">{settings.storeName}</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-black">{order.code}</h1><p className="mt-1 text-sm text-white/80">Referência {order.reference}</p></div><span className="w-fit rounded-full bg-white/20 px-3 py-1.5 text-sm font-black">{statusLabel[order.status]}</span></div>
          </div>
          <div className="p-5 sm:p-8">
            {order.status === "cancelled" ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"><strong>Pedido cancelado.</strong><p className="mt-1 text-sm">Fale com a loja caso precise de ajuda.</p></div> : <><div className="mb-3 flex items-center justify-between"><h2 className="font-black">Acompanhe seu pedido</h2><span className="text-xs text-gray-400">Atualiza automaticamente</span></div><div className={`grid gap-2 ${order.type === "delivery" ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>{steps.map((step, index) => { const Icon = step.icon; const done = activeIndex >= index || order.status === "completed"; const active = activeIndex === index; return <div key={step.key} className={`rounded-2xl border p-3 ${done ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50"}`}><div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${active ? "text-white" : done ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500"}`} style={active ? { backgroundColor: settings.primaryColor } : undefined}><Icon className="h-4 w-4" /></div><p className={`text-xs font-black ${done ? "text-gray-900" : "text-gray-400"}`}>{step.label}</p></div> })}</div><p className="mt-3 text-xs text-gray-500">Horário escolhido: <strong>{date(order.requestedFor)}</strong>{order.scheduled ? " · agendado" : ""}.</p></>}

            {order.type === "delivery" && tracking?.enabled && (
              <section className={`mt-6 overflow-hidden rounded-2xl border ${tracking.state === "active" ? "border-emerald-200 bg-emerald-50/50" : tracking.state === "other-delivery" ? "border-amber-200 bg-amber-50" : "border-blue-100 bg-blue-50/50"}`}>
                <div className="flex items-start gap-3 p-4">
                  <div className={`mt-0.5 rounded-xl p-2 ${tracking.state === "active" ? "bg-emerald-100 text-emerald-700" : tracking.state === "other-delivery" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {tracking.state === "active" ? <Truck className="h-5 w-5" /> : tracking.state === "other-delivery" ? <ShieldCheck className="h-5 w-5" /> : <Navigation className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black">
                      {tracking.state === "active"
                        ? "Entregador a caminho"
                        : tracking.state === "other-delivery"
                          ? "Entregador em outra entrega"
                          : tracking.state === "waiting-departure"
                            ? "Entregador definido"
                            : tracking.state === "waiting-courier"
                              ? "Aguardando entregador"
                              : tracking.state === "active-location-pending"
                                ? "Entrega em rota"
                                : "Preparando sua entrega"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">{tracking.message}</p>
                    {tracking.courierName && <p className="mt-1 text-xs font-bold text-gray-500">Entregador: {tracking.courierName}</p>}
                    {tracking.state === "other-delivery" && (
                      <p className="mt-2 text-xs font-semibold text-amber-800">Por privacidade, o mapa e a posição do entregador ficam ocultos até o seu pedido ser a entrega ativa.</p>
                    )}
                  </div>
                </div>

                {tracking.state === "active" && tracking.location && (
                  <div className="border-t border-emerald-200 bg-white">
                    <iframe
                      title="Localização atual do entregador"
                      src={liveMapUrl(tracking.location.latitude, tracking.location.longitude)}
                      className="h-64 w-full border-0"
                      loading="lazy"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-gray-500">
                      <span>Atualizado {new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium" }).format(new Date(tracking.location.updatedAt))}</span>
                      {tracking.location.accuracyMeters !== null && (
                        <span>Precisão aproximada: {Math.round(tracking.location.accuracyMeters)} m</span>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <section className="rounded-2xl border border-gray-200 p-4"><h2 className="font-black">Itens</h2><div className="mt-3 space-y-2">{order.items.map((item, index) => <div key={`${item.productId}-${index}`} className="flex items-start justify-between gap-3 text-sm"><div><span><strong>{item.quantity}x</strong> {item.name}</span>{item.modifiers?.length ? <div className="mt-1 space-y-0.5 pl-4">{item.modifiers.map((modifier) => <p key={`${modifier.groupId}-${modifier.optionId}`} className="text-xs text-gray-500">+ {modifier.optionName}{modifier.included ? " · incluído" : modifier.priceDelta > 0 ? ` · + ${money(modifier.priceDelta)}` : ""}</p>)}</div> : null}</div><strong>{money(item.subtotal)}</strong></div>)}</div><div className="mt-3 border-t border-gray-100 pt-3"><div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>{order.discount > 0 && <div className="mt-1 flex justify-between text-xs font-bold text-emerald-700"><span>Desconto {order.couponCode ? `(${order.couponCode})` : ""}</span><span>-{money(order.discount)}</span></div>}{order.deliveryFee > 0 && <div className="mt-1 flex justify-between text-xs text-gray-500"><span>Entrega</span><span>{money(order.deliveryFee)}</span></div>}<div className="mt-2 flex justify-between"><strong>Total</strong><strong className="text-lg">{money(order.total)}</strong></div></div></section>
              <section className="rounded-2xl border border-gray-200 p-4"><h2 className="font-black">Dados do pedido</h2><div className="mt-3 space-y-2 text-sm text-gray-600"><p><strong className="text-gray-900">Cliente:</strong> {order.customer.name}</p><p><strong className="text-gray-900">Criado:</strong> {date(order.createdAt)}</p><p><strong className="text-gray-900">Receber:</strong> {date(order.requestedFor)}</p><p><strong className="text-gray-900">Tipo:</strong> {order.type === "delivery" ? "Delivery" : "Retirada"}</p><p><strong className="text-gray-900">Pagamento:</strong> {order.paymentMethod === "pix" ? "PIX" : order.paymentMethod === "cash" ? "Dinheiro" : "Cartão"} · {order.paymentStatus === "paid" ? "Pago" : "Pendente"}</p>{order.type === "delivery" && <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{order.customer.address}, {order.customer.number}{order.customer.district ? ` - ${order.customer.district}` : ""}</p>}</div></section>
            </div>

            {order.notes && <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><strong>Observação:</strong> {order.notes}</div>}
            <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${whatsappMessage}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700"><MessageCircle className="h-4 w-4" />Falar com a loja no WhatsApp</a>

            {order.status === "completed" && <section className="mt-6 rounded-3xl border border-violet-100 bg-violet-50/60 p-5">
              <div className="flex items-center gap-2"><Star className="h-5 w-5 text-violet-600" /><h2 className="font-black">Como foi sua experiência?</h2></div>
              {!feedbackSent ? <><p className="mt-2 text-sm text-gray-600">Sua nota fica registrada no sistema da loja. Depois você pode publicar sua experiência no Google.</p><div className="mt-4 grid grid-cols-5 gap-2">{reactions.map((reaction, index) => <button key={reaction} type="button" onClick={() => setRating(index + 1)} className={`rounded-2xl border p-3 text-2xl transition ${rating === index + 1 ? "border-violet-400 bg-white shadow-sm" : "border-violet-100 bg-white/70"}`}><span>{reaction}</span><span className="mt-1 block text-[10px] font-black text-gray-500">{index + 1}</span></button>)}</div><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Conte o que achou (opcional)" rows={3} className="mt-3 w-full rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm outline-none"/>{feedbackError && <p className="mt-2 text-xs font-bold text-red-600">{feedbackError}</p>}<button type="button" onClick={sendFeedback} disabled={feedbackBusy} className="mt-3 h-11 w-full rounded-xl bg-violet-600 text-sm font-black text-white disabled:opacity-50">{feedbackBusy ? "Enviando..." : `Enviar nota ${rating}/5`}</button></> : <div className="mt-3 rounded-2xl bg-white p-4"><p className="font-black text-emerald-700">Obrigado pela avaliação! {reactions[rating - 1]}</p>{settings.googleReviewUrl ? <><p className="mt-1 text-sm text-gray-600">O Google exige que a própria pessoa publique a avaliação na conta dela. Use o botão abaixo para abrir diretamente a tela de avaliação.</p><a href={settings.googleReviewUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white">Avaliar também no Google <ExternalLink className="h-4 w-4" /></a></> : <p className="mt-1 text-sm text-gray-500">O admin ainda não configurou o link de avaliações do Google.</p>}</div>}
            </section>}
          </div>
        </section>
      </div>
    </main>
  )
}
