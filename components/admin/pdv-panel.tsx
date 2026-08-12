"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Loader2,
  MapPin,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
  X,
} from "lucide-react"
import { ProductCustomizer, type ProductCustomization } from "@/components/catalog/product-customizer"
import { GoogleAddressAutocomplete } from "@/components/maps/google-address-autocomplete"
import { geocodeGoogleAddress } from "@/lib/google-maps-client"
import { modifierSelectionKey, productHasModifiers } from "@/lib/product-composition"
import { HelpTip } from "@/components/admin/help-tip"
import type { CustomerAccount, Order, OrderItemModifier, Product, StoreSettings } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

type Item = {
  key: string
  product: Product
  quantity: number
  optionIds: number[]
  unitPrice: number
  modifiers: OrderItemModifier[]
}

type PdvCustomer = Omit<CustomerAccount, "cpfHash" | "pinHash">

type DeliveryQuote = {
  fee: number
  label: string
  distanceKm: number | null
  durationMinutes: number | null
  mode: StoreSettings["deliveryPricingMode"]
  zone?: { id: number; name: string } | null
}

const emptyAddress = {
  address: "",
  number: "",
  district: "",
  city: "",
  state: "",
  zipCode: "",
  complement: "",
  latitude: null as number | null,
  longitude: null as number | null,
}

export function PdvPanel({ products, settings, onOrderCreated }: { products: Product[]; settings: StoreSettings; onOrderCreated: (order: Order) => void }) {
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<Item[]>([])
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null)
  const [orderType, setOrderType] = useState<Order["type"]>(settings.pickupEnabled ? "pickup" : settings.deliveryEnabled ? "delivery" : "pickup")
  const [name, setName] = useState(settings.pickupEnabled ? "Balcão" : "")
  const [phone, setPhone] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<Order["paymentMethod"]>(settings.cashEnabled ? "cash" : settings.pixEnabled ? "pix" : "card")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const [customers, setCustomers] = useState<PdvCustomer[]>([])
  const [customersLoaded, setCustomersLoaded] = useState(false)
  const [customersLoading, setCustomersLoading] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [deliveryAddress, setDeliveryAddress] = useState(emptyAddress)
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null)
  const [quoteBusy, setQuoteBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return products.filter((p) => p.active && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)))
  }, [products, search])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [items])
  const total = subtotal + (orderType === "delivery" ? deliveryQuote?.fee || 0 : 0)

  useEffect(() => {
    if (orderType !== "delivery" || customersLoaded || customersLoading) return

    let cancelled = false
    setCustomersLoading(true)

    fetch("/api/admin/pdv-customers", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar os clientes.")
        if (!cancelled) {
          setCustomers(Array.isArray(data.customers) ? data.customers : [])
          setCustomersLoaded(true)
        }
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Não foi possível carregar os clientes.")
      })
      .finally(() => {
        if (!cancelled) setCustomersLoading(false)
      })

    return () => { cancelled = true }
  }, [orderType, customersLoaded, customersLoading])

  useEffect(() => {
    setDeliveryQuote(null)
  }, [subtotal])

  function totalQuantity(productId: number) {
    return items.filter((item) => item.product.id === productId).reduce((sum, item) => sum + item.quantity, 0)
  }

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

  function invalidateLocation(patch: Partial<typeof emptyAddress>) {
    setDeliveryAddress((current) => ({ ...current, ...patch, latitude: null, longitude: null }))
    setDeliveryQuote(null)
  }

  function selectOrderType(next: Order["type"]) {
    if (next === "pickup" && !settings.pickupEnabled) return
    if (next === "delivery" && !settings.deliveryEnabled) return
    setOrderType(next)
    setMessage("")
    setDeliveryQuote(null)
    if (next === "pickup" && !selectedAccountId) setName((current) => current.trim() || "Balcão")
    if (next === "delivery" && name === "Balcão") setName("")
  }

  function selectCustomer(value: string) {
    const id = Number(value)
    if (!id) {
      setSelectedAccountId(null)
      return
    }

    const customer = customers.find((item) => item.id === id)
    if (!customer) return

    setSelectedAccountId(customer.id)
    setName(customer.name)
    setPhone(customer.phone)
    setDeliveryAddress({
      address: customer.defaultAddress || "",
      number: customer.defaultNumber || "",
      district: customer.defaultDistrict || "",
      city: customer.defaultCity || settings.city || "",
      state: customer.defaultState || settings.state || "",
      zipCode: customer.defaultZipCode || "",
      complement: customer.defaultComplement || "",
      latitude: customer.defaultLatitude,
      longitude: customer.defaultLongitude,
    })
    setDeliveryQuote(null)
  }

  function fullAddress() {
    return [
      deliveryAddress.address,
      deliveryAddress.number,
      deliveryAddress.district,
      deliveryAddress.city,
      deliveryAddress.state,
      deliveryAddress.zipCode,
    ].filter(Boolean).join(", ")
  }

  async function quoteDelivery() {
    if (orderType !== "delivery") return
    if (!items.length) return setMessage("Adicione pelo menos um produto antes de calcular a entrega.")
    if (!deliveryAddress.address.trim() || !deliveryAddress.number.trim()) return setMessage("Informe o endereço e o número da entrega.")

    setQuoteBusy(true)
    setMessage("")

    try {
      let latitude = deliveryAddress.latitude
      let longitude = deliveryAddress.longitude
      let locatedAddress = deliveryAddress

      if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const located = await geocodeGoogleAddress(fullAddress())
        latitude = located.latitude
        longitude = located.longitude
        locatedAddress = {
          ...deliveryAddress,
          address: located.address.address || deliveryAddress.address,
          district: located.address.district || deliveryAddress.district,
          city: located.address.city || deliveryAddress.city,
          state: located.address.state || deliveryAddress.state,
          zipCode: located.address.zipCode || deliveryAddress.zipCode,
          latitude,
          longitude,
        }
        setDeliveryAddress(locatedAddress)
      }

      if (latitude === null || longitude === null) throw new Error("Não foi possível localizar o endereço da entrega.")

      const params = new URLSearchParams({
        lat: String(latitude),
        lng: String(longitude),
        subtotal: String(subtotal),
      })
      const response = await fetch(`/api/admin/pdv-delivery-quote?${params.toString()}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível calcular a entrega.")
      setDeliveryQuote(data.quote)
    } catch (error) {
      setDeliveryQuote(null)
      setMessage(error instanceof Error ? error.message : "Não foi possível calcular a entrega.")
    } finally {
      setQuoteBusy(false)
    }
  }

  async function createOrder() {
    if (!items.length) return setMessage("Adicione pelo menos um produto.")
    if (orderType === "delivery") {
      if (!name.trim() || !phone.trim()) return setMessage("Nome e telefone são obrigatórios para entrega.")
      if (!deliveryAddress.address.trim() || !deliveryAddress.number.trim()) return setMessage("Informe endereço e número para entrega.")
      if (deliveryAddress.latitude === null || deliveryAddress.longitude === null || !Number.isFinite(deliveryAddress.latitude) || !Number.isFinite(deliveryAddress.longitude)) return setMessage("Localize o endereço e calcule a entrega antes de registrar o pedido.")
      if (!deliveryQuote) return setMessage("Calcule a taxa de entrega antes de registrar o pedido.")
    }

    setBusy(true)
    setMessage("")

    try {
      const customer = orderType === "delivery"
        ? {
            name: name.trim(),
            phone: phone.trim(),
            address: deliveryAddress.address.trim(),
            number: deliveryAddress.number.trim(),
            district: deliveryAddress.district.trim(),
            city: deliveryAddress.city.trim(),
            state: deliveryAddress.state.trim(),
            zipCode: deliveryAddress.zipCode.trim(),
            complement: deliveryAddress.complement.trim(),
            latitude: deliveryAddress.latitude,
            longitude: deliveryAddress.longitude,
            ...(selectedAccountId ? { accountId: selectedAccountId } : {}),
          }
        : {
            name: name.trim() || "Balcão",
            phone: phone.trim(),
            address: "",
            ...(selectedAccountId ? { accountId: selectedAccountId } : {}),
          }

      const response = await fetch("/api/admin/pdv-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: orderType,
          paymentMethod,
          customer,
          accountId: selectedAccountId || undefined,
          items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity, modifierOptionIds: item.optionIds })),
          timing: "now",
          notes,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao criar pedido.")

      onOrderCreated(data.order)
      setItems([])
      setOrderType(settings.pickupEnabled ? "pickup" : settings.deliveryEnabled ? "delivery" : "pickup")
      setName(settings.pickupEnabled ? "Balcão" : "")
      setPhone("")
      setNotes("")
      setSelectedAccountId(null)
      setDeliveryAddress(emptyAddress)
      setDeliveryQuote(null)
      setMessage(`${data.order.code} criado com sucesso.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro no PDV.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-black">Pedidos PDV</h2><p className="text-sm text-gray-500">Balcão, retirada ou entrega com preço, complementos e estoque validados no servidor.</p></div>
          <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto" className="h-10 rounded-xl border border-gray-200 pl-9 pr-3 text-sm"/></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((product) => { const q = totalQuantity(product.id); const unavailable = (product.trackStock && product.stock <= 0) || product.ingredientStockAvailable === false; const configurable = productHasModifiers(product); return <article key={product.id} className="rounded-2xl border border-gray-200 p-3"><div className="flex gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-amber-50">{product.image ? <img src={product.image} alt="" className="h-full w-full object-cover"/> : "🥟"}</div><div className="min-w-0 flex-1"><p className="truncate font-black">{product.name}</p><p className="text-xs text-gray-500">{product.category}</p><p className="mt-1 font-black text-blue-700">{configurable ? `a partir de ${money(product.price)}` : money(product.price)}</p></div></div><div className="mt-3">{unavailable ? <span className="text-xs font-bold text-red-600">Indisponível por estoque</span> : configurable ? <button onClick={() => setCustomizingProduct(product)} className="h-9 w-full rounded-xl bg-blue-700 text-xs font-black text-white">Montar {q > 0 ? `· ${q} no pedido` : ""}</button> : q === 0 ? <button onClick={() => setSimpleQuantity(product, 1)} className="h-9 w-full rounded-xl bg-blue-700 text-xs font-black text-white">Adicionar</button> : <div className="flex items-center justify-between rounded-xl bg-gray-100 p-1"><button onClick={() => setSimpleQuantity(product, q - 1)} className="rounded-lg p-2 hover:bg-white"><Minus className="h-4 w-4"/></button><strong>{q}</strong><button onClick={() => setSimpleQuantity(product, q + 1)} className="rounded-lg p-2 hover:bg-white"><Plus className="h-4 w-4"/></button></div>}</div></article> })}</div>
      </div>

      <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:sticky xl:top-20">
        <div className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-blue-700"/><h2 className="font-black">Novo pedido</h2>{orderType === "delivery" && <HelpTip helpKey="pdv.delivery" />}</div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={!settings.pickupEnabled} onClick={() => selectOrderType("pickup")} className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${orderType === "pickup" ? "border-blue-700 bg-blue-50 text-blue-800" : "border-gray-200 bg-white text-gray-600"}`}><Store className="h-4 w-4"/>Retirada</button>
          <button type="button" disabled={!settings.deliveryEnabled} onClick={() => selectOrderType("delivery")} className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${orderType === "delivery" ? "border-blue-700 bg-blue-50 text-blue-800" : "border-gray-200 bg-white text-gray-600"}`}><Truck className="h-4 w-4"/>Entrega</button>
        </div>

        <div className="mt-4 space-y-2">{items.map((item) => <div key={item.key} className="rounded-xl bg-gray-50 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.quantity}x {item.product.name}</p><p className="text-xs text-gray-500">{money(item.unitPrice * item.quantity)}</p>{item.modifiers.length > 0 && <div className="mt-1 space-y-0.5">{item.modifiers.map((modifier) => <p key={`${modifier.groupId}-${modifier.optionId}`} className="text-[11px] text-gray-500">+ {modifier.optionName}{modifier.included ? " · incluído" : modifier.priceDelta > 0 ? ` · + ${money(modifier.priceDelta)}` : ""}</p>)}</div>}</div><button onClick={() => setItemQuantity(item.key, 0)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4"/></button></div><div className="mt-2 flex w-28 items-center justify-between rounded-lg bg-white p-1"><button onClick={() => setItemQuantity(item.key, item.quantity - 1)} className="p-1"><Minus className="h-3.5 w-3.5"/></button><strong className="text-xs">{item.quantity}</strong><button onClick={() => setItemQuantity(item.key, item.quantity + 1)} className="p-1"><Plus className="h-3.5 w-3.5"/></button></div></div>)}</div>
        {!items.length && <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">Carrinho vazio</div>}

        {orderType === "delivery" && (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
            <div className="flex items-center gap-2 text-sm font-black text-blue-900"><UserRound className="h-4 w-4"/>Cliente e endereço <HelpTip helpKey="pdv.deliveryQuote" /></div>
            <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-gray-500">Cliente cadastrado</label>
            <select value={selectedAccountId || ""} onChange={(e) => selectCustomer(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm">
              <option value="">Digitar cliente / endereço manualmente</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}{customer.defaultAddress ? " · endereço salvo" : ""}</option>)}
            </select>
            {customersLoading && <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500"><Loader2 className="h-3 w-3 animate-spin"/>Carregando clientes…</p>}

            <div className="mt-3">
              <GoogleAddressAutocomplete
                placeholder="Buscar rua, número ou CEP"
                biasCenter={Number.isFinite(settings.storeLatitude) && Number.isFinite(settings.storeLongitude) ? { lat: settings.storeLatitude, lng: settings.storeLongitude } : undefined}
                onSelect={(selection) => {
                  setDeliveryAddress({
                    address: selection.address.address || "",
                    number: selection.address.number || "",
                    district: selection.address.district || "",
                    city: selection.address.city || settings.city || "",
                    state: selection.address.state || settings.state || "",
                    zipCode: selection.address.zipCode || "",
                    complement: deliveryAddress.complement,
                    latitude: selection.latitude,
                    longitude: selection.longitude,
                  })
                  setDeliveryQuote(null)
                }}
              />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_90px]">
              <input value={deliveryAddress.address} onChange={(e) => invalidateLocation({ address: e.target.value })} placeholder="Rua / avenida" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"/>
              <input value={deliveryAddress.number} onChange={(e) => invalidateLocation({ number: e.target.value })} placeholder="Número" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"/>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input value={deliveryAddress.district} onChange={(e) => invalidateLocation({ district: e.target.value })} placeholder="Bairro" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"/>
              <input value={deliveryAddress.zipCode} onChange={(e) => invalidateLocation({ zipCode: e.target.value })} placeholder="CEP" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"/>
              <input value={deliveryAddress.city} onChange={(e) => invalidateLocation({ city: e.target.value })} placeholder="Cidade" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"/>
              <input value={deliveryAddress.state} onChange={(e) => invalidateLocation({ state: e.target.value })} placeholder="UF" maxLength={2} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm uppercase"/>
            </div>
            <input value={deliveryAddress.complement} onChange={(e) => setDeliveryAddress((current) => ({ ...current, complement: e.target.value }))} placeholder="Complemento / referência (opcional)" className="mt-2 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/>

            <button type="button" onClick={quoteDelivery} disabled={quoteBusy || !items.length} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-xs font-black text-white disabled:opacity-50">{quoteBusy ? <Loader2 className="h-4 w-4 animate-spin"/> : <MapPin className="h-4 w-4"/>}{quoteBusy ? "Calculando…" : "Localizar e calcular entrega"}</button>

            {deliveryQuote && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><p className="font-black">Taxa: {money(deliveryQuote.fee)} · {deliveryQuote.label}</p>{deliveryQuote.distanceKm !== null && <p className="mt-1">Distância pelas ruas: {deliveryQuote.distanceKm.toFixed(1).replace(".", ",")} km{deliveryQuote.durationMinutes ? ` · cerca de ${deliveryQuote.durationMinutes} min de rota` : ""}</p>}</div>}
          </div>
        )}

        <div className="mt-4 grid gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={orderType === "delivery" ? "Nome do cliente *" : "Nome do cliente"} className="h-10 rounded-xl border border-gray-200 px-3 text-sm"/>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={orderType === "delivery" ? "Telefone / WhatsApp *" : "Telefone (opcional)"} className="h-10 rounded-xl border border-gray-200 px-3 text-sm"/>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as Order["paymentMethod"])} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm">{settings.cashEnabled && <option value="cash">Dinheiro</option>}{settings.pixEnabled && <option value="pix">PIX</option>}{settings.cardEnabled && <option value="card">Cartão</option>}</select>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observação" className="rounded-xl border border-gray-200 px-3 py-2 text-sm"/>
        </div>

        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between text-sm"><span className="font-bold text-gray-500">Subtotal</span><strong>{money(subtotal)}</strong></div>
          {orderType === "delivery" && <div className="flex items-center justify-between text-sm"><span className="font-bold text-gray-500">Entrega</span><strong>{deliveryQuote ? money(deliveryQuote.fee) : "Calcular"}</strong></div>}
          <div className="flex items-center justify-between"><span className="font-black text-gray-700">Total</span><strong className="text-2xl">{money(total)}</strong></div>
        </div>

        {message && <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{message}</p>}
        <button onClick={createOrder} disabled={busy || !items.length || (orderType === "delivery" && !deliveryQuote)} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-black text-white disabled:opacity-50"><ReceiptText className="h-4 w-4"/>{busy ? "Salvando..." : orderType === "delivery" ? "Registrar pedido para entrega" : "Registrar pedido"}</button>
      </aside>

      <ProductCustomizer product={customizingProduct} primaryColor="#1d4ed8" onClose={() => setCustomizingProduct(null)} onConfirm={(customization) => customizingProduct && addCustomizedProduct(customizingProduct, customization)} />
    </section>
  )
}
