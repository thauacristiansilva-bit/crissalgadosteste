"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChefHat, Clock3, Home, MapPin, MessageCircle, PackageCheck, Truck } from "lucide-react"
import type { Order } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))

const statusLabel: Record<Order["status"], string> = {
  pending: "Pedido recebido",
  accepted: "Pedido aceito",
  preparing: "Em preparação",
  ready: "Pedido pronto",
  "in-route": "Saiu para entrega",
  completed: "Concluído",
  cancelled: "Cancelado",
}

export function OrderTracker({ initialOrder, whatsapp, storeName, estimatedMinutes }: { initialOrder: Order; whatsapp: string; storeName: string; estimatedMinutes: number }) {
  const [order, setOrder] = useState(initialOrder)

  useEffect(() => {
    if (["completed", "cancelled"].includes(order.status)) return
    const id = window.setInterval(async () => {
      const response = await fetch(`/api/order-status/${encodeURIComponent(order.reference)}`, { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      setOrder(data.order)
    }, 12000)
    return () => window.clearInterval(id)
  }, [order.reference, order.status])

  const steps = useMemo(() => {
    const base = [
      { key: "accepted", label: "Aceito", icon: Clock3 },
      { key: "preparing", label: "Preparando", icon: ChefHat },
      { key: "ready", label: "Pronto", icon: PackageCheck },
    ]
    if (order.type === "delivery") base.push({ key: "in-route", label: "Em rota", icon: Truck })
    base.push({ key: "completed", label: order.type === "delivery" ? "Entregue" : "Retirado", icon: CheckCircle2 })
    return base
  }, [order.type])

  const activeIndex = steps.findIndex((step) => step.key === order.status)

  function whatsappMessage() {
    return encodeURIComponent(`Olá! Quero falar sobre o pedido ${order.reference} (${order.code}).`)
  }

  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-6 text-gray-950 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-orange-600"><Home className="h-4 w-4" />Voltar ao cardápio</a>
        <section className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-xl shadow-orange-100/60">
          <div className="bg-gradient-to-br from-orange-500 to-red-500 p-6 text-white sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-100">{storeName}</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-black">{order.code}</h1><p className="mt-1 text-sm text-orange-100">Referência {order.reference}</p></div><span className="w-fit rounded-full bg-white/20 px-3 py-1.5 text-sm font-black">{statusLabel[order.status]}</span></div>
          </div>

          <div className="p-5 sm:p-8">
            {order.status === "cancelled" ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"><strong>Pedido cancelado.</strong><p className="mt-1 text-sm">Fale com a loja caso precise de ajuda.</p></div> : <><div className="mb-3 flex items-center justify-between"><h2 className="font-black">Acompanhe seu pedido</h2><span className="text-xs text-gray-400">Atualiza automaticamente</span></div><div className="grid gap-2 sm:grid-cols-5">{steps.map((step, index) => { const Icon = step.icon; const done = activeIndex >= index || order.status === "completed"; const active = activeIndex === index; return <div key={step.key} className={`rounded-2xl border p-3 ${done ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50"}`}><div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${active ? "bg-orange-500 text-white" : done ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500"}`}><Icon className="h-4 w-4" /></div><p className={`text-xs font-black ${done ? "text-gray-900" : "text-gray-400"}`}>{step.label}</p></div> })}</div><p className="mt-3 text-xs text-gray-500">Horário escolhido para recebimento: <strong>{date(order.requestedFor)}</strong>{order.scheduled ? " · pedido agendado" : ""}. Para delivery, a operação trabalha dentro da janela configurada pela loja.</p></>}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <section className="rounded-2xl border border-gray-200 p-4"><h2 className="font-black">Itens</h2><div className="mt-3 space-y-2">{order.items.map((item, index) => <div key={`${item.productId}-${index}`} className="flex justify-between gap-3 text-sm"><span><strong>{item.quantity}x</strong> {item.name}</span><strong>{money(item.subtotal)}</strong></div>)}</div><div className="mt-3 border-t border-gray-100 pt-3"><div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>{order.deliveryFee > 0 && <div className="mt-1 flex justify-between text-xs text-gray-500"><span>Entrega</span><span>{money(order.deliveryFee)}</span></div>}<div className="mt-2 flex justify-between"><strong>Total</strong><strong className="text-lg">{money(order.total)}</strong></div></div></section>
              <section className="rounded-2xl border border-gray-200 p-4"><h2 className="font-black">Dados do pedido</h2><div className="mt-3 space-y-2 text-sm text-gray-600"><p><strong className="text-gray-900">Cliente:</strong> {order.customer.name}</p><p><strong className="text-gray-900">Criado:</strong> {date(order.createdAt)}</p><p><strong className="text-gray-900">Horário escolhido:</strong> {date(order.requestedFor)}</p><p><strong className="text-gray-900">Recebimento:</strong> {order.type === "delivery" ? "Delivery" : "Retirada"}</p><p><strong className="text-gray-900">Pagamento:</strong> {order.paymentMethod === "pix" ? "PIX" : order.paymentMethod === "cash" ? "Dinheiro" : "Cartão"} · {order.paymentStatus === "paid" ? "Pago" : "Pendente"}</p>{order.type === "delivery" && <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{order.customer.address}, {order.customer.number}{order.customer.district ? ` - ${order.customer.district}` : ""}</p>}</div></section>
            </div>

            {order.notes && <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><strong>Observação:</strong> {order.notes}</div>}
            <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${whatsappMessage()}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700"><MessageCircle className="h-4 w-4" />Falar com a loja no WhatsApp</a>
          </div>
        </section>
      </div>
    </main>
  )
}
