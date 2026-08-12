"use client"

import { useMemo, useState } from "react"
import { Minus, Plus, ReceiptText, Search, ShoppingBag, X } from "lucide-react"
import { ProductCustomizer, type ProductCustomization } from "@/components/catalog/product-customizer"
import { modifierSelectionKey, productHasModifiers } from "@/lib/product-composition"
import type { Order, OrderItemModifier, Product, StoreSettings } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

type Item = {
  key: string
  product: Product
  quantity: number
  optionIds: number[]
  unitPrice: number
  modifiers: OrderItemModifier[]
}

export function PdvPanel({ products, settings, onOrderCreated }: { products: Product[]; settings: StoreSettings; onOrderCreated: (order: Order) => void }) {
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<Item[]>([])
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null)
  const [name, setName] = useState("Balcão")
  const [phone, setPhone] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<Order["paymentMethod"]>(settings.cashEnabled ? "cash" : settings.pixEnabled ? "pix" : "card")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const filtered = useMemo(() => { const q = search.toLowerCase().trim(); return products.filter((p) => p.active && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))) }, [products, search])
  const total = useMemo(() => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [items])

  function totalQuantity(productId: number) { return items.filter((item) => item.product.id === productId).reduce((sum, item) => sum + item.quantity, 0) }

  function setSimpleQuantity(product: Product, value: number) {
    if (product.trackStock) value = Math.min(value, product.stock)
    const cartKey = modifierSelectionKey(product.id, [])
    setItems((current) => value <= 0
      ? current.filter((item) => item.key !== cartKey)
      : current.some((item) => item.key === cartKey)
        ? current.map((item) => item.key === cartKey ? { ...item, quantity: value } : item)
        : [...current, { key: cartKey, product, quantity: value, optionIds: [], unitPrice: product.price, modifiers: [] }])
  }

  function setItemQuantity(cartKey: string, value: number) {
    setItems((current) => {
      const item = current.find((candidate) => candidate.key === cartKey)
      if (!item) return current
      let next = value
      if (item.product.trackStock) {
        const otherQuantity = current.filter((candidate) => candidate.product.id === item.product.id && candidate.key !== cartKey).reduce((sum, candidate) => sum + candidate.quantity, 0)
        next = Math.min(next, Math.max(0, item.product.stock - otherQuantity))
      }
      return next <= 0 ? current.filter((candidate) => candidate.key !== cartKey) : current.map((candidate) => candidate.key === cartKey ? { ...candidate, quantity: next } : candidate)
    })
  }

  function addCustomizedProduct(product: Product, customization: ProductCustomization) {
    const cartKey = modifierSelectionKey(product.id, customization.optionIds)
    setItems((current) => {
      const existing = current.find((item) => item.key === cartKey)
      const totalForProduct = current.filter((item) => item.product.id === product.id).reduce((sum, item) => sum + item.quantity, 0)
      if (product.trackStock && totalForProduct >= product.stock) return current
      if (existing) return current.map((item) => item.key === cartKey ? { ...item, quantity: item.quantity + 1 } : item)
      return [...current, { key: cartKey, product, quantity: 1, optionIds: customization.optionIds, unitPrice: customization.unitPrice, modifiers: customization.modifiers }]
    })
    setCustomizingProduct(null)
  }

  async function createOrder() {
    if (!items.length) return setMessage("Adicione pelo menos um produto.")
    setBusy(true); setMessage("")
    try {
      const requestedFor = new Date(Date.now() + 5 * 60000).toISOString()
      const response = await fetch("/api/admin/pdv-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pickup",
          paymentMethod,
          customer: { name: name.trim() || "Balcão", phone, address: "" },
          items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity, modifierOptionIds: item.optionIds })),
          requestedFor,
          notes,
        }),
      })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Erro ao criar pedido.")
      onOrderCreated(data.order); setItems([]); setName("Balcão"); setPhone(""); setNotes(""); setMessage(`${data.order.code} criado com sucesso.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro no PDV.") } finally { setBusy(false) }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">Pedidos PDV / Balcão</h2><p className="text-sm text-gray-500">Venda presencial com montagem, preço e estoque validados no servidor.</p></div><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto" className="h-10 rounded-xl border border-gray-200 pl-9 pr-3 text-sm"/></label></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((product) => { const q = totalQuantity(product.id); const unavailable = (product.trackStock && product.stock <= 0) || product.ingredientStockAvailable === false; const configurable = productHasModifiers(product); return <article key={product.id} className="rounded-2xl border border-gray-200 p-3"><div className="flex gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-amber-50">{product.image ? <img src={product.image} alt="" className="h-full w-full object-cover"/> : "🥟"}</div><div className="min-w-0 flex-1"><p className="truncate font-black">{product.name}</p><p className="text-xs text-gray-500">{product.category}</p><p className="mt-1 font-black text-blue-700">{configurable ? `a partir de ${money(product.price)}` : money(product.price)}</p></div></div><div className="mt-3">{unavailable ? <span className="text-xs font-bold text-red-600">Indisponível por estoque</span> : configurable ? <button onClick={() => setCustomizingProduct(product)} className="h-9 w-full rounded-xl bg-blue-700 text-xs font-black text-white">Montar {q > 0 ? `· ${q} no pedido` : ""}</button> : q === 0 ? <button onClick={() => setSimpleQuantity(product, 1)} className="h-9 w-full rounded-xl bg-blue-700 text-xs font-black text-white">Adicionar</button> : <div className="flex items-center justify-between rounded-xl bg-gray-100 p-1"><button onClick={() => setSimpleQuantity(product, q - 1)} className="rounded-lg p-2 hover:bg-white"><Minus className="h-4 w-4"/></button><strong>{q}</strong><button onClick={() => setSimpleQuantity(product, q + 1)} className="rounded-lg p-2 hover:bg-white"><Plus className="h-4 w-4"/></button></div>}</div></article> })}</div>
      </div>

      <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:sticky xl:top-20">
        <div className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-blue-700"/><h2 className="font-black">Novo pedido</h2></div>
        <div className="mt-4 space-y-2">{items.map((item) => <div key={item.key} className="rounded-xl bg-gray-50 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.quantity}x {item.product.name}</p><p className="text-xs text-gray-500">{money(item.unitPrice * item.quantity)}</p>{item.modifiers.length > 0 && <div className="mt-1 space-y-0.5">{item.modifiers.map((modifier) => <p key={`${modifier.groupId}-${modifier.optionId}`} className="text-[11px] text-gray-500">+ {modifier.optionName}{modifier.included ? " · incluído" : modifier.priceDelta > 0 ? ` · + ${money(modifier.priceDelta)}` : ""}</p>)}</div>}</div><button onClick={() => setItemQuantity(item.key, 0)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4"/></button></div><div className="mt-2 flex w-28 items-center justify-between rounded-lg bg-white p-1"><button onClick={() => setItemQuantity(item.key, item.quantity - 1)} className="p-1"><Minus className="h-3.5 w-3.5"/></button><strong className="text-xs">{item.quantity}</strong><button onClick={() => setItemQuantity(item.key, item.quantity + 1)} className="p-1"><Plus className="h-3.5 w-3.5"/></button></div></div>)}</div>
        {!items.length && <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">Carrinho vazio</div>}
        <div className="mt-4 grid gap-3"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" className="h-10 rounded-xl border border-gray-200 px-3 text-sm"/><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone (opcional)" className="h-10 rounded-xl border border-gray-200 px-3 text-sm"/><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as Order["paymentMethod"])} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm">{settings.cashEnabled && <option value="cash">Dinheiro</option>}{settings.pixEnabled && <option value="pix">PIX</option>}{settings.cardEnabled && <option value="card">Cartão</option>}</select><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observação" className="rounded-xl border border-gray-200 px-3 py-2 text-sm"/></div>
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4"><span className="font-bold text-gray-500">Total</span><strong className="text-2xl">{money(total)}</strong></div>
        {message && <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{message}</p>}
        <button onClick={createOrder} disabled={busy || !items.length} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-black text-white disabled:opacity-50"><ReceiptText className="h-4 w-4"/>{busy ? "Salvando..." : "Registrar pedido"}</button>
      </aside>

      <ProductCustomizer product={customizingProduct} primaryColor="#1d4ed8" onClose={() => setCustomizingProduct(null)} onConfirm={(customization) => customizingProduct && addCustomizedProduct(customizingProduct, customization)} />
    </section>
  )
}
