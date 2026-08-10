"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bike, CalendarDays, Check, ChevronRight, Clock3, MapPin, Minus, Plus, Search, ShoppingBag, Store, X } from "lucide-react"
import { findDeliveryZone, isStoreOpenNow } from "@/lib/operations"
import type { Category, DeliveryZone, Product, StoreSettings } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
const displayDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00-03:00`))

type CartItem = { product: Product; quantity: number }
type Checkout = {
  name: string
  phone: string
  type: "pickup" | "delivery"
  scheduleDate: string
  scheduleTime: string
  zipCode: string
  address: string
  number: string
  district: string
  city: string
  state: string
  complement: string
  latitude: number | null
  longitude: number | null
  paymentMethod: "pix" | "cash" | "card"
  changeFor: string
  notes: string
}

function fortalezaDateString(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number)
  return h * 60 + m
}

export function Storefront({
  products,
  categories,
  settings,
  deliveryZones,
  openNow,
}: {
  products: Product[]
  categories: Category[]
  settings: StoreSettings
  deliveryZones: DeliveryZone[]
  openNow: boolean
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(openNow)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Todos")
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [cepBusy, setCepBusy] = useState(false)
  const [locationBusy, setLocationBusy] = useState(false)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [checkout, setCheckout] = useState<Checkout>({
    name: "",
    phone: "",
    type: settings.pickupEnabled ? "pickup" : "delivery",
    scheduleDate: "",
    scheduleTime: "",
    zipCode: "",
    address: "",
    number: "",
    district: "",
    city: settings.city,
    state: settings.state,
    complement: "",
    latitude: null,
    longitude: null,
    paymentMethod: "pix",
    changeFor: "",
    notes: "",
  })

  useEffect(() => {
    const update = () => setIsOpen(isStoreOpenNow(settings))
    update()
    const id = window.setInterval(update, 30000)
    return () => window.clearInterval(id)
  }, [settings])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((product) => product.active).filter((product) => category === "Todos" || product.category === category).filter((product) => !q || product.name.toLowerCase().includes(q) || product.description.toLowerCase().includes(q)).sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name, "pt-BR"))
  }, [products, search, category])

  const availableDates = useMemo(() => {
    const dates: Array<{ value: string; label: string }> = []
    const now = new Date()
    const seen = new Set<string>()
    for (let i = 0; i <= settings.schedulingDaysAhead; i += 1) {
      const current = new Date(now.getTime() + i * 86400000)
      const value = fortalezaDateString(current)
      if (seen.has(value)) continue
      seen.add(value)
      const day = new Date(`${value}T12:00:00-03:00`).getUTCDay()
      const schedule = settings.businessHours.find((item) => item.day === day)
      if (schedule?.enabled) dates.push({ value, label: i === 0 ? `Hoje · ${displayDate(value)}` : i === 1 ? `Amanhã · ${displayDate(value)}` : displayDate(value) })
    }
    return dates
  }, [settings.businessHours, settings.schedulingDaysAhead])

  const selectedDate = checkout.scheduleDate
  const timeSlots = useMemo(() => {
    if (!selectedDate) return []
    const day = new Date(`${selectedDate}T12:00:00-03:00`).getUTCDay()
    const schedule = settings.businessHours.find((item) => item.day === day)
    if (!schedule?.enabled) return []
    const start = timeToMinutes(schedule.open)
    const end = timeToMinutes(schedule.close)
    const lead = checkout.type === "delivery" ? settings.deliveryMinMinutes : settings.pickupLeadMinutes
    const minimum = Date.now() + lead * 60000
    const result: string[] = []
    for (let value = start; value <= end; value += settings.slotIntervalMinutes) {
      const text = minutesToTime(value)
      const date = new Date(`${selectedDate}T${text}:00-03:00`)
      if (date.getTime() >= minimum) result.push(text)
    }
    return result
  }, [checkout.type, selectedDate, settings.businessHours, settings.deliveryMinMinutes, settings.pickupLeadMinutes, settings.slotIntervalMinutes])

  const selectedTime = timeSlots.includes(checkout.scheduleTime) ? checkout.scheduleTime : ""
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [cart])
  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])
  const deliveryQuote = useMemo(() => checkout.latitude != null && checkout.longitude != null ? findDeliveryZone(deliveryZones, checkout.latitude, checkout.longitude) : null, [checkout.latitude, checkout.longitude, deliveryZones])
  const deliveryFee = checkout.type === "delivery" ? deliveryQuote?.zone.fee || 0 : 0
  const total = subtotal + deliveryFee

  function setQuantity(product: Product, quantity: number) {
    if (product.trackStock) quantity = Math.min(quantity, product.stock)
    if (quantity <= 0) return setCart((current) => current.filter((item) => item.product.id !== product.id))
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (existing) return current.map((item) => item.product.id === product.id ? { ...item, quantity } : item)
      return [...current, { product, quantity }]
    })
  }

  function quantityFor(productId: number) {
    return cart.find((item) => item.product.id === productId)?.quantity || 0
  }

  function changeAddress(patch: Partial<Checkout>) {
    setCheckout((current) => ({ ...current, ...patch, latitude: null, longitude: null }))
  }

  async function searchCep() {
    const cep = checkout.zipCode.replace(/\D/g, "")
    if (cep.length !== 8) return setError("Digite um CEP válido com 8 números.")
    setCepBusy(true)
    setError("")
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await response.json()
      if (!response.ok || data.erro) throw new Error("CEP não encontrado.")
      changeAddress({ zipCode: cep, address: data.logradouro || checkout.address, district: data.bairro || checkout.district, city: data.localidade || checkout.city, state: data.uf || checkout.state })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível buscar o CEP.")
    } finally {
      setCepBusy(false)
    }
  }

  async function locateAddress() {
    if (!checkout.address.trim() || !checkout.number.trim() || !checkout.city.trim()) return setError("Preencha rua, número e cidade antes de calcular a entrega.")
    setQuoteBusy(true)
    setError("")
    try {
      const query = [checkout.address, checkout.number, checkout.district, checkout.city, checkout.state, checkout.zipCode, "Brasil"].filter(Boolean).join(", ")
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } })
      const data = await response.json()
      if (!response.ok || !Array.isArray(data) || !data.length) throw new Error("Não consegui localizar esse endereço. Use o GPS ou confira os dados.")
      const latitude = Number(data[0].lat)
      const longitude = Number(data[0].lon)
      const quote = findDeliveryZone(deliveryZones, latitude, longitude)
      setCheckout((current) => ({ ...current, latitude, longitude }))
      if (!quote) throw new Error("Esse endereço está fora das áreas de entrega cadastradas.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível calcular a entrega.")
    } finally {
      setQuoteBusy(false)
    }
  }

  function useLocation() {
    if (!navigator.geolocation) return setError("Seu navegador não oferece localização.")
    setLocationBusy(true)
    setError("")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude
        setCheckout((current) => ({ ...current, latitude, longitude }))
        if (!findDeliveryZone(deliveryZones, latitude, longitude)) setError("Sua localização está fora das áreas de entrega cadastradas.")
        setLocationBusy(false)
      },
      () => { setError("Não foi possível obter sua localização. Confira a permissão do navegador."); setLocationBusy(false) },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault()
    const date = checkout.scheduleDate
    const time = checkout.scheduleTime
    if (!isOpen) return setError("Pedidos são aceitos somente durante o horário de funcionamento.")
    if (!cart.length) return setError("Seu carrinho está vazio.")
    if (!checkout.name.trim() || !checkout.phone.trim()) return setError("Informe nome e telefone.")
    if (!date || !time) return setError("Escolha o dia e o horário de recebimento.")
    if (checkout.type === "delivery" && (!checkout.address.trim() || !checkout.number.trim())) return setError("Informe endereço e número para delivery.")
    if (checkout.type === "delivery" && !deliveryQuote) return setError("Calcule a entrega pelo endereço ou GPS antes de finalizar.")
    setSending(true)
    setError("")
    try {
      const requestedFor = new Date(`${date}T${time}:00-03:00`).toISOString()
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: checkout.type,
          requestedFor,
          paymentMethod: checkout.paymentMethod,
          changeFor: checkout.paymentMethod === "cash" ? checkout.changeFor : "",
          notes: checkout.notes,
          customer: { name: checkout.name, phone: checkout.phone, address: checkout.address, number: checkout.number, district: checkout.district, city: checkout.city, state: checkout.state, zipCode: checkout.zipCode, complement: checkout.complement, latitude: checkout.latitude, longitude: checkout.longitude },
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar o pedido.")
      localStorage.setItem("cris_last_order", data.order.reference)
      setCart([])
      router.push(`/pedido/${encodeURIComponent(data.order.reference)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar pedido.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fffaf5] text-gray-950">
      <header className="border-b border-orange-100 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-2xl shadow-sm">🥟</div><div><h1 className="text-lg font-black sm:text-xl">{settings.storeName}</h1><p className="text-xs text-gray-500">{settings.slogan}</p></div></div><a href="/login" className="hidden rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 sm:inline-flex">Área administrativa</a></div></header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-red-500 p-6 text-white shadow-lg sm:p-8"><div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${isOpen ? "bg-white/20" : "bg-gray-950/20"}`}><span className={`h-2 w-2 rounded-full ${isOpen ? "bg-emerald-300" : "bg-gray-300"}`} />{isOpen ? "Aceitando pedidos agora" : "Fora do horário de pedidos"}</div><h2 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Escolha o horário que quer receber seus salgados.</h2><p className="mt-3 max-w-2xl text-sm text-orange-50 sm:text-base">Pedidos feitos durante o expediente são confirmados automaticamente e entram na fila da cozinha por horário.</p></div><div className="grid gap-2 rounded-2xl bg-white/15 p-4 text-sm backdrop-blur"><p className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Delivery: {settings.deliveryMinMinutes}–{settings.deliveryMaxMinutes} min</p><p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{settings.address}, {settings.city} - {settings.state}</p><p className="flex items-center gap-2"><Store className="h-4 w-4" />{settings.openingHours}</p></div></div></section>

        <section className="sticky top-0 z-20 -mx-4 mt-5 border-y border-orange-100 bg-[#fffaf5]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"><div className="mx-auto flex max-w-7xl gap-3 overflow-x-auto"><label className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no cardápio" className="h-11 w-full rounded-xl border border-orange-100 bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100" /></label><div className="flex gap-2">{["Todos", ...categories.filter((item) => item.active).map((item) => item.name)].map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-xl px-4 text-sm font-bold ${category === item ? "bg-gray-950 text-white" : "border border-orange-100 bg-white text-gray-700"}`}>{item}</button>)}</div></div></section>

        <section className="mt-6"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-2xl font-black">Cardápio</h2><p className="text-sm text-gray-500">{filtered.length} produto(s) encontrado(s)</p></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((product) => { const quantity = quantityFor(product.id); const unavailable = product.trackStock && product.stock <= 0; return <article key={product.id} className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm"><div className="flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50 to-amber-100">{product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-cover" /> : <span className="text-6xl">🥟</span>}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">{product.category}</span><h3 className="mt-1 font-black">{product.name}</h3></div>{product.featured && <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-700">Destaque</span>}</div><p className="mt-2 min-h-10 text-sm text-gray-500">{product.description}</p><div className="mt-4 flex items-center justify-between gap-3"><strong className="text-lg">{money(product.price)}</strong>{unavailable ? <span className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500">Indisponível</span> : quantity === 0 ? <button onClick={() => setQuantity(product, 1)} className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-black text-white hover:bg-orange-600">+ Adicionar</button> : <div className="flex items-center gap-2 rounded-xl bg-gray-100 p-1"><button onClick={() => setQuantity(product, quantity - 1)} className="rounded-lg p-1.5 hover:bg-white"><Minus className="h-4 w-4" /></button><strong className="min-w-5 text-center text-sm">{quantity}</strong><button onClick={() => setQuantity(product, quantity + 1)} className="rounded-lg p-1.5 hover:bg-white"><Plus className="h-4 w-4" /></button></div>}</div></div></article>})}</div>{!filtered.length && <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center text-sm text-gray-500">Nenhum produto encontrado.</div>}</section>
      </main>

      {totalItems > 0 && <button onClick={() => setCartOpen(true)} className="fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between rounded-2xl bg-gray-950 px-4 py-3 text-white shadow-2xl"><span className="flex items-center gap-3"><span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-orange-500 px-2 text-sm font-black">{totalItems}</span><span className="text-left"><small className="block text-[10px] uppercase tracking-wide text-gray-400">Seu pedido</small><strong>{money(subtotal)}</strong></span></span><span className="flex items-center gap-1 text-sm font-bold">Ver carrinho <ChevronRight className="h-4 w-4" /></span></button>}

      {cartOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 sm:items-center sm:p-4"><button aria-label="Fechar" onClick={() => setCartOpen(false)} className="absolute inset-0" /><div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-black">Seu carrinho</h2><p className="text-sm text-gray-500">Confira antes de continuar.</p></div><button onClick={() => setCartOpen(false)} className="rounded-xl bg-gray-100 p-2"><X className="h-5 w-5" /></button></div><div className="space-y-3">{cart.map((item) => <div key={item.product.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-orange-50">{item.product.image ? <img src={item.product.image} alt="" className="h-full w-full object-cover" /> : "🥟"}</div><div className="min-w-0 flex-1"><p className="font-bold">{item.product.name}</p><p className="text-xs text-gray-500">{money(item.product.price)} cada</p></div><div className="flex items-center gap-2 rounded-xl bg-gray-100 p-1"><button onClick={() => setQuantity(item.product, item.quantity - 1)} className="p-1"><Minus className="h-4 w-4" /></button><strong className="min-w-5 text-center text-sm">{item.quantity}</strong><button onClick={() => setQuantity(item.product, item.quantity + 1)} className="p-1"><Plus className="h-4 w-4" /></button></div><strong className="w-20 text-right text-sm">{money(item.product.price * item.quantity)}</strong></div>)}</div><div className="my-5 flex items-center justify-between border-t border-gray-100 pt-4"><span className="font-semibold text-gray-500">Subtotal</span><strong className="text-xl">{money(subtotal)}</strong></div><button disabled={!isOpen} onClick={() => { setCartOpen(false); setCheckoutOpen(true) }} className="h-12 w-full rounded-xl bg-orange-500 font-black text-white hover:bg-orange-600 disabled:opacity-50">{isOpen ? "Escolher recebimento" : "Pedidos fora do expediente"}</button></div></div>}

      {checkoutOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 sm:items-center sm:p-4"><button aria-label="Fechar" onClick={() => setCheckoutOpen(false)} className="absolute inset-0" /><form onSubmit={submitOrder} className="relative max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-black">Finalizar pedido</h2><p className="text-sm text-gray-500">Escolha quando quer receber. O pedido será aceito automaticamente.</p></div><button type="button" onClick={() => setCheckoutOpen(false)} className="rounded-xl bg-gray-100 p-2"><X className="h-5 w-5" /></button></div>{error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</div>}<div className="space-y-5">
        <section><h3 className="mb-3 font-black">1. Seus dados</h3><div className="grid gap-3 sm:grid-cols-2"><input required value={checkout.name} onChange={(e)=>setCheckout({...checkout,name:e.target.value})} placeholder="Nome *" className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-300"/><input required value={checkout.phone} onChange={(e)=>setCheckout({...checkout,phone:e.target.value})} placeholder="WhatsApp *" className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-300"/></div></section>
        <section><h3 className="mb-3 font-black">2. Como vai receber?</h3><div className="grid gap-3 sm:grid-cols-2">{settings.pickupEnabled && <button type="button" onClick={()=>setCheckout({...checkout,type:"pickup",scheduleTime:""})} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${checkout.type === "pickup" ? "border-orange-400 bg-orange-50" : "border-gray-200"}`}><Store className="h-5 w-5"/><span><strong className="block">Retirada</strong><small className="text-gray-500">Buscar no estabelecimento</small></span>{checkout.type === "pickup" && <Check className="ml-auto h-5 w-5 text-orange-600"/>}</button>}{settings.deliveryEnabled && <button type="button" onClick={()=>setCheckout({...checkout,type:"delivery",scheduleTime:""})} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${checkout.type === "delivery" ? "border-orange-400 bg-orange-50" : "border-gray-200"}`}><Bike className="h-5 w-5"/><span><strong className="block">Delivery</strong><small className="text-gray-500">Taxa calculada pela área</small></span>{checkout.type === "delivery" && <Check className="ml-auto h-5 w-5 text-orange-600"/>}</button>}</div></section>
        <section><h3 className="mb-3 flex items-center gap-2 font-black"><CalendarDays className="h-5 w-5 text-orange-500" />3. Dia e horário de recebimento</h3><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Dia</span><select required value={selectedDate} onChange={(e)=>setCheckout({...checkout,scheduleDate:e.target.value,scheduleTime:""})} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"><option value="">Escolha o dia</option>{availableDates.map((date)=><option key={date.value} value={date.value}>{date.label}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Horário</span><select required disabled={!selectedDate || !timeSlots.length} value={selectedTime} onChange={(e)=>setCheckout({...checkout,scheduleTime:e.target.value})} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:bg-gray-100"><option value="">{selectedDate ? (timeSlots.length ? "Escolha o horário" : "Sem horário disponível") : "Escolha o dia primeiro"}</option>{timeSlots.map((slot)=><option key={slot} value={slot}>{slot}</option>)}</select></label></div><div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">{checkout.type === "delivery" ? `Para delivery, o sistema considera uma janela operacional de ${settings.deliveryMinMinutes} a ${settings.deliveryMaxMinutes} minutos. Em pedidos agendados, a cozinha prioriza o horário escolhido por você.` : `Para retirada, escolha um horário com pelo menos ${settings.pickupLeadMinutes} minutos de antecedência.`}</div></section>
        {checkout.type === "delivery" && <section><h3 className="mb-3 font-black">4. Endereço e taxa</h3><div className="grid gap-3 sm:grid-cols-2"><div className="flex gap-2 sm:col-span-2"><input value={checkout.zipCode} onChange={(e)=>changeAddress({zipCode:e.target.value})} placeholder="CEP" className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-300"/><button type="button" onClick={searchCep} disabled={cepBusy} className="rounded-xl bg-gray-100 px-4 text-sm font-bold">{cepBusy ? "Buscando..." : "Buscar CEP"}</button></div><input required value={checkout.address} onChange={(e)=>changeAddress({address:e.target.value})} placeholder="Rua / Avenida *" className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-300 sm:col-span-2"/><input required value={checkout.number} onChange={(e)=>changeAddress({number:e.target.value})} placeholder="Número *" className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-300"/><input value={checkout.district} onChange={(e)=>changeAddress({district:e.target.value})} placeholder="Bairro" className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-300"/><input value={checkout.city} onChange={(e)=>changeAddress({city:e.target.value})} placeholder="Cidade" className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-300"/><input value={checkout.state} onChange={(e)=>changeAddress({state:e.target.value})} placeholder="UF" className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-300"/><input value={checkout.complement} onChange={(e)=>setCheckout({...checkout,complement:e.target.value})} placeholder="Complemento / referência" className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-300 sm:col-span-2"/><button type="button" onClick={locateAddress} disabled={quoteBusy} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-bold text-white sm:col-span-2"><MapPin className="h-4 w-4"/>{quoteBusy ? "Localizando..." : "Calcular taxa neste endereço"}</button><button type="button" onClick={useLocation} disabled={locationBusy} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 text-sm font-bold text-blue-700 sm:col-span-2"><MapPin className="h-4 w-4"/>{locationBusy ? "Obtendo GPS..." : "Ou usar minha localização GPS"}</button>{deliveryQuote && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800 sm:col-span-2">✓ Área: {deliveryQuote.zone.name} · Taxa {money(deliveryQuote.zone.fee)}</div>}{checkout.latitude != null && checkout.longitude != null && !deliveryQuote && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 sm:col-span-2">Fora das áreas de entrega cadastradas.</div>}</div></section>}
        <section><h3 className="mb-3 font-black">{checkout.type === "delivery" ? "5" : "4"}. Pagamento</h3><div className="grid gap-2 sm:grid-cols-3">{[["pix","PIX"],["cash","Dinheiro"],["card","Cartão na entrega"]].map(([value,label])=><button type="button" key={value} onClick={()=>setCheckout({...checkout,paymentMethod:value as Checkout["paymentMethod"]})} className={`rounded-xl border px-3 py-3 text-sm font-bold ${checkout.paymentMethod === value ? "border-orange-400 bg-orange-50 text-orange-800" : "border-gray-200"}`}>{label}</button>)}</div>{checkout.paymentMethod === "cash" && <input value={checkout.changeFor} onChange={(e)=>setCheckout({...checkout,changeFor:e.target.value})} placeholder="Troco para quanto? Ex.: 50,00" className="mt-3 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-300"/>}</section>
        <section><h3 className="mb-3 font-black">Observações</h3><textarea value={checkout.notes} onChange={(e)=>setCheckout({...checkout,notes:e.target.value})} placeholder="Ex.: sem molho, tocar interfone..." rows={3} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-orange-300"/></section>
        <section className="rounded-2xl bg-gray-50 p-4"><div className="flex justify-between text-sm text-gray-600"><span>Produtos</span><span>{money(subtotal)}</span></div>{checkout.type === "delivery" && <div className="mt-2 flex justify-between text-sm text-gray-600"><span>Taxa de entrega</span><span>{deliveryQuote ? money(deliveryFee) : "A calcular"}</span></div>}<div className="mt-3 flex justify-between border-t border-gray-200 pt-3"><strong>Total</strong><strong className="text-xl">{money(total)}</strong></div></section>
        <button disabled={sending || !isOpen || !selectedDate || !selectedTime || (checkout.type === "delivery" && !deliveryQuote)} className="h-12 w-full rounded-xl bg-orange-500 font-black text-white hover:bg-orange-600 disabled:opacity-50">{sending ? "Enviando pedido..." : `Confirmar pedido · ${money(total)}`}</button>
      </div></form></div>}
    </div>
  )
}
