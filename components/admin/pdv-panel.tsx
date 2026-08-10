"use client"

import { useMemo, useState } from "react"
import { Minus, Plus, ReceiptText, Search, ShoppingBag, X } from "lucide-react"
import type { Order, Product, StoreSettings } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

type Item = { product: Product; quantity: number }

export function PdvPanel({ products, settings, onOrderCreated }: { products: Product[]; settings: StoreSettings; onOrderCreated: (order: Order) => void }) {
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<Item[]>([])
  const [name, setName] = useState("Balcão")
  const [phone, setPhone] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<Order["paymentMethod"]>(settings.cashEnabled ? "cash" : settings.pixEnabled ? "pix" : "card")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const filtered = useMemo(() => { const q = search.toLowerCase().trim(); return products.filter((p) => p.active && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))) }, [products, search])
  const total = useMemo(() => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [items])

  function quantity(productId: number) { return items.find((item) => item.product.id === productId)?.quantity || 0 }
  function setQuantity(product: Product, value: number) { if (product.trackStock) value = Math.min(value, product.stock); setItems((current) => value <= 0 ? current.filter((item) => item.product.id !== product.id) : current.some((item) => item.product.id === product.id) ? current.map((item) => item.product.id === product.id ? { ...item, quantity: value } : item) : [...current, { product, quantity: value }]) }

  async function createOrder() {
    if (!items.length) return setMessage("Adicione pelo menos um produto.")
    setBusy(true); setMessage("")
    try {
      const requestedFor = new Date(Date.now() + 5 * 60000).toISOString()
      const response = await fetch("/api/admin/pdv-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "pickup", paymentMethod, customer: { name: name.trim() || "Balcão", phone, address: "" }, items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })), requestedFor, notes }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Erro ao criar pedido.")
      onOrderCreated(data.order); setItems([]); setName("Balcão"); setPhone(""); setNotes(""); setMessage(`${data.order.code} criado com sucesso.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro no PDV.") } finally { setBusy(false) }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">Pedidos PDV / Balcão</h2><p className="text-sm text-gray-500">Venda rápida presencial, com o mesmo estoque do cardápio.</p></div><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto" className="h-10 rounded-xl border border-gray-200 pl-9 pr-3 text-sm"/></label></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((product) => { const q = quantity(product.id); const unavailable = product.trackStock && product.stock <= 0; return <article key={product.id} className="rounded-2xl border border-gray-200 p-3"><div className="flex gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-amber-50">{product.image ? <img src={product.image} alt="" className="h-full w-full object-cover"/> : "🥟"}</div><div className="min-w-0 flex-1"><p className="truncate font-black">{product.name}</p><p className="text-xs text-gray-500">{product.category}</p><p className="mt-1 font-black text-blue-700">{money(product.price)}</p></div></div><div className="mt-3">{unavailable ? <span className="text-xs font-bold text-red-600">Sem estoque</span> : q === 0 ? <button onClick={() => setQuantity(product, 1)} className="h-9 w-full rounded-xl bg-blue-700 text-xs font-black text-white">Adicionar</button> : <div className="flex items-center justify-between rounded-xl bg-gray-100 p-1"><button onClick={() => setQuantity(product, q - 1)} className="rounded-lg p-2 hover:bg-white"><Minus className="h-4 w-4"/></button><strong>{q}</strong><button onClick={() => setQuantity(product, q + 1)} className="rounded-lg p-2 hover:bg-white"><Plus className="h-4 w-4"/></button></div>}</div></article> })}</div>
      </div>

      <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:sticky xl:top-20">
        <div className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-blue-700"/><h2 className="font-black">Novo pedido</h2></div>
        <div className="mt-4 space-y-2">{items.map((item) => <div key={item.product.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.quantity}x {item.product.name}</p><p className="text-xs text-gray-500">{money(item.product.price * item.quantity)}</p></div><button onClick={() => setQuantity(item.product, 0)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4"/></button></div>)}</div>
        {!items.length && <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">Carrinho vazio</div>}
        <div className="mt-4 grid gap-3"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" className="h-10 rounded-xl border border-gray-200 px-3 text-sm"/><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone (opcional)" className="h-10 rounded-xl border border-gray-200 px-3 text-sm"/><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as Order["paymentMethod"])} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm">{settings.cashEnabled && <option value="cash">Dinheiro</option>}{settings.pixEnabled && <option value="pix">PIX</option>}{settings.cardEnabled && <option value="card">Cartão</option>}</select><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observação" className="rounded-xl border border-gray-200 px-3 py-2 text-sm"/></div>
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4"><span className="font-bold text-gray-500">Total</span><strong className="text-2xl">{money(total)}</strong></div>
        {message && <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{message}</p>}
        <button onClick={createOrder} disabled={busy || !items.length} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-black text-white disabled:opacity-50"><ReceiptText className="h-4 w-4"/>{busy ? "Salvando..." : "Registrar pedido"}</button>
      </aside>
    </section>
  )
}
