"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bike, CalendarDays, Check, ChevronRight, Clock3, ExternalLink, Globe2, Info, LogIn, MapPin, MessageCircle, Minus, Plus, Search, ShoppingBag, Store, UserRound, X } from "lucide-react"
import { FacebookBrandIcon, InstagramBrandIcon, YouTubeBrandIcon } from "@/components/icons/social-brand-icons"
import { isStoreOpenNow, zonedDateString, zonedDateTime } from "@/lib/operations"
import { IMMEDIATE_DELIVERY_MIN_MINUTES, IMMEDIATE_DELIVERY_MAX_MINUTES, MAX_SCHEDULING_DAYS } from "@/lib/order-timing"
import { geocodeGoogleAddress, reverseGeocodeGoogle, type GoogleAddress } from "@/lib/google-maps-client"
import { DeliveryLocationMap } from "@/components/store/delivery-location-map"
import { GoogleAddressAutocomplete, type GoogleAddressSelection } from "@/components/maps/google-address-autocomplete"
import { ClientAccountModal } from "@/components/store/client-account-modal"
import { StoreChatbot } from "@/components/store/store-chatbot"
import { ProductCustomizer, type ProductCustomization } from "@/components/catalog/product-customizer"
import {
  modifierSelectionKey,
  productHasModifiers,
  validateAndPriceModifierSelection,
} from "@/lib/product-composition"
import type { Category, DeliveryZone, Order, OrderItemModifier, Product, StoreSettings } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

type CartItem = {
  key: string
  product: Product
  quantity: number
  optionIds: number[]
  unitPrice: number
  modifiers: OrderItemModifier[]
}
type CustomerPublic = {
  id: number; cpfLast4: string; name: string; phone: string; email: string
  defaultAddress: string; defaultNumber: string; defaultDistrict: string; defaultCity: string; defaultState: string; defaultZipCode: string; defaultComplement: string
  defaultLatitude: number | null; defaultLongitude: number | null; loyaltyPoints: number
}
type Checkout = {
  name: string; phone: string; type: "pickup" | "delivery"; timing: "now" | "scheduled"; scheduleDate: string; scheduleTime: string
  zipCode: string; address: string; number: string; district: string; city: string; state: string; complement: string
  latitude: number | null; longitude: number | null; paymentMethod: "pix" | "cash" | "card"; changeFor: string; notes: string; couponCode: string
}

function minutesToTime(minutes: number) { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}` }
function timeToMinutes(value: string) { const [h, m] = value.split(":").map(Number); return h * 60 + m }
function formatCep(value: string) { const digits = value.replace(/\D/g, "").slice(0, 8); return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits }
function externalUrl(value: string) { const clean = value.trim(); if (!clean) return ""; return /^https?:\/\//i.test(clean) ? clean : `https://${clean}` }

export function Storefront({
  products,
  categories,
  settings,
  deliveryZones,
  openNow,
  organization,
}: {
  products: Product[]
  categories: Category[]
  settings: StoreSettings
  deliveryZones: DeliveryZone[]
  openNow: boolean
  organization?: {
    id: string
    name: string
    slug: string
    publicOrderingEnabled?: boolean
  }
}) {
  const router = useRouter()
  const cartStorageKey = organization?.slug
    ? `saborflow_cart_v2:${organization.slug}`
    : "saborflow_cart_v2:default"

  const orderPath = (reference: string) =>
    organization?.slug
      ? `/loja/${encodeURIComponent(
          organization.slug,
        )}/pedido/${encodeURIComponent(reference)}`
      : `/pedido/${encodeURIComponent(reference)}`
  const [isOpen, setIsOpen] = useState(openNow)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Todos")
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartHydrated, setCartHydrated] = useState(false)
  const cartLoadedKeyRef = useRef("")
  const [cartOpen, setCartOpen] = useState(false)
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [customer, setCustomer] = useState<CustomerPublic | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [addressNotice, setAddressNotice] = useState("")
  const [locationBusy, setLocationBusy] = useState(false)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [deliveryQuote, setDeliveryQuote] = useState<{ fee: number; label: string; distanceKm: number | null; durationMinutes: number | null } | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [showDeliveryMap, setShowDeliveryMap] = useState(false)
  const [cepBusy, setCepBusy] = useState(false)
  const cepLookupIdRef = useRef(0)
  const cepTimerRef = useRef<number | null>(null)
  const [couponBusy, setCouponBusy] = useState(false)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponMessage, setCouponMessage] = useState("")
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null)
  const [checkout, setCheckout] = useState<Checkout>({
    name: "", phone: "", type: settings.pickupEnabled ? "pickup" : "delivery", timing: openNow ? "now" : "scheduled", scheduleDate: "", scheduleTime: "", zipCode: "", address: "", number: "", district: "", city: settings.city, state: settings.state, complement: "", latitude: null, longitude: null, paymentMethod: settings.pixEnabled ? "pix" : settings.cashEnabled ? "cash" : "card", changeFor: "", notes: "", couponCode: "",
  })

  useEffect(() => { const update = () => setIsOpen(isStoreOpenNow(settings)); update(); const id = window.setInterval(update, 30000); return () => window.clearInterval(id) }, [settings])
  useEffect(() => {
    if (isOpen || !settings.acceptingOrders) return
    setCheckout((current) =>
      current.timing === "scheduled"
        ? current
        : { ...current, timing: "scheduled", scheduleDate: "", scheduleTime: "" },
    )
  }, [isOpen, settings.acceptingOrders])
  useEffect(() => { fetch("/api/client/me", { cache: "no-store" }).then((r) => r.json()).then((data) => { if (data.customer) setCustomer(data.customer) }).catch(() => undefined) }, [])

  useEffect(() => {
    if (cartLoadedKeyRef.current === cartStorageKey) return
    cartLoadedKeyRef.current = cartStorageKey
    setCart([])
    setCartHydrated(false)

    try {
      const saved = window.localStorage.getItem(cartStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{ productId?: number; quantity?: number; optionIds?: number[] }>
        if (Array.isArray(parsed)) {
          const restored = parsed.flatMap((entry) => {
            const product = products.find((item) => item.id === Number(entry.productId))
            if (!product || !product.active) return []
            const optionIds = Array.isArray(entry.optionIds) ? entry.optionIds.map(Number) : []
            const pricing = validateCartCustomization(product, optionIds)
            if (!pricing) return []
            let quantity = Math.max(1, Math.floor(Number(entry.quantity || 1)))
            if (product.trackStock) quantity = Math.min(quantity, product.stock)
            return quantity > 0 ? [{
              key: modifierSelectionKey(product.id, optionIds),
              product,
              quantity,
              optionIds,
              unitPrice: pricing.unitPrice,
              modifiers: pricing.modifiers,
            }] : []
          })
          setCart(restored)
        }
      }
    } catch {
      window.localStorage.removeItem(cartStorageKey)
    } finally {
      setCartHydrated(true)
    }
  }, [products, cartStorageKey])

  useEffect(() => {
    if (!cartHydrated) return
    if (!cart.length) {
      window.localStorage.removeItem(cartStorageKey)
      return
    }
    window.localStorage.setItem(
      cartStorageKey,
      JSON.stringify(
        cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          optionIds: item.optionIds,
        })),
      ),
    )
  }, [cart, cartHydrated, cartStorageKey])
  useEffect(() => {
    if (settings.googleAnalyticsId) {
      const id = settings.googleAnalyticsId.trim()
      if (id && !document.querySelector(`script[data-cris-ga="${id}"]`)) {
        const external = document.createElement("script"); external.async = true; external.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`; external.dataset.crisGa = id; document.head.appendChild(external)
        const w = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }; w.dataLayer = w.dataLayer || []; w.gtag = (...args: unknown[]) => { w.dataLayer?.push(args) }; w.gtag("js", new Date()); w.gtag("config", id)
      }
    }
    if (settings.metaPixelId) {
      const id = settings.metaPixelId.trim()
      if (id && !document.querySelector(`script[data-cris-meta="${id}"]`)) {
        const script = document.createElement("script"); script.dataset.crisMeta = id; script.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id.replace(/'/g, "")}');fbq('track','PageView');`; document.head.appendChild(script)
      }
    }
  }, [settings.googleAnalyticsId, settings.metaPixelId])
  useEffect(() => {
    if (!customer) return
    setCheckout((current) => ({ ...current, name: customer.name || current.name, phone: customer.phone || current.phone, address: customer.defaultAddress || current.address, number: customer.defaultNumber || current.number, district: customer.defaultDistrict || current.district, city: customer.defaultCity || current.city, state: customer.defaultState || current.state, zipCode: customer.defaultZipCode || current.zipCode, complement: customer.defaultComplement || current.complement, latitude: customer.defaultLatitude ?? current.latitude, longitude: customer.defaultLongitude ?? current.longitude }))
  }, [customer])

  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return products.filter((p) => p.active).filter((p) => category === "Todos" || p.category === category).filter((p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)).sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name, "pt-BR")) }, [products, search, category])
  const selectedDate = checkout.timing === "scheduled" ? checkout.scheduleDate : ""
  const organizationTimeZone = settings.timeZone || "America/Sao_Paulo"
  const schedulingDaysAhead = Math.min(
    MAX_SCHEDULING_DAYS,
    Math.max(1, Number(settings.schedulingDaysAhead || MAX_SCHEDULING_DAYS)),
  )
  const scheduleMinDate = zonedDateString(new Date(), organizationTimeZone)
  const scheduleMaxDate = zonedDateString(
    new Date(Date.now() + schedulingDaysAhead * 86400000),
    organizationTimeZone,
  )
  const timeSlots = useMemo(() => {
    if (checkout.timing !== "scheduled" || !selectedDate) return []
    const day = new Date(`${selectedDate}T12:00:00Z`).getUTCDay()
    const schedule = settings.businessHours.find((item) => item.day === day)
    if (!schedule?.enabled) return []
    const start = timeToMinutes(schedule.open)
    const end = timeToMinutes(schedule.close)
    const lead = checkout.type === "delivery" ? settings.deliveryMinMinutes : settings.pickupLeadMinutes
    const minimum = Date.now() + lead * 60000
    const result: string[] = []
    for (let value = start; value <= end; value += settings.slotIntervalMinutes) {
      const text = minutesToTime(value)
      const date = zonedDateTime(selectedDate, text, organizationTimeZone)
      if (date.getTime() >= minimum) result.push(text)
    }
    return result
  }, [checkout.timing, checkout.type, selectedDate, settings.businessHours, settings.deliveryMinMinutes, settings.pickupLeadMinutes, settings.slotIntervalMinutes, organizationTimeZone])
  const selectedTime = checkout.timing === "scheduled" && timeSlots.includes(checkout.scheduleTime) ? checkout.scheduleTime : ""
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart])
  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])
  const deliveryFee = checkout.type === "delivery" ? deliveryQuote?.fee || 0 : 0
  const total = Math.max(0, subtotal - couponDiscount) + deliveryFee

  function validateCartCustomization(product: Product, optionIds: number[]) {
    const result = validateAndPriceModifierSelection(product, optionIds)
    return result.ok ? result : null
  }

  function totalProductQuantity(productId: number) {
    return cart.filter((item) => item.product.id === productId).reduce((sum, item) => sum + item.quantity, 0)
  }

  function setSimpleProductQuantity(product: Product, quantity: number) {
    const key = modifierSelectionKey(product.id, [])
    if (product.trackStock) quantity = Math.min(quantity, product.stock)
    if (quantity <= 0) return setCart((current) => current.filter((item) => item.key !== key))
    setCart((current) => {
      const existing = current.find((item) => item.key === key)
      const pricing = validateCartCustomization(product, [])
      if (!pricing) return current
      if (existing) return current.map((item) => item.key === key ? { ...item, quantity } : item)
      return [...current, { key, product, quantity, optionIds: [], unitPrice: pricing.unitPrice, modifiers: pricing.modifiers }]
    })
  }

  function setCartItemQuantity(key: string, quantity: number) {
    setCart((current) => {
      const target = current.find((item) => item.key === key)
      if (!target) return current
      let next = quantity
      if (target.product.trackStock) {
        const otherQuantity = current
          .filter((item) => item.product.id === target.product.id && item.key !== key)
          .reduce((sum, item) => sum + item.quantity, 0)
        next = Math.min(next, Math.max(0, target.product.stock - otherQuantity))
      }
      if (next <= 0) return current.filter((item) => item.key !== key)
      return current.map((item) => item.key === key ? { ...item, quantity: next } : item)
    })
  }

  function addCustomizedProduct(product: Product, customization: ProductCustomization) {
    const key = modifierSelectionKey(product.id, customization.optionIds)
    setCart((current) => {
      const currentProductQuantity = current
        .filter((item) => item.product.id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0)
      if (product.trackStock && currentProductQuantity >= product.stock) return current
      const existing = current.find((item) => item.key === key)
      if (existing) {
        return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...current, {
        key,
        product,
        quantity: 1,
        optionIds: customization.optionIds,
        unitPrice: customization.unitPrice,
        modifiers: customization.modifiers,
      }]
    })
    setCustomizingProduct(null)
  }

  function quantityFor(productId: number) { return totalProductQuantity(productId) }
  function changeAddress(patch: Partial<Checkout>) { setCheckout((current) => ({ ...current, ...patch, latitude: null, longitude: null })); setGpsAccuracy(null); setDeliveryQuote(null); setAddressNotice("") }

  async function refreshDeliveryQuote(latitude: number, longitude: number) {
    setQuoteBusy(true)
    setDeliveryQuote(null)
    try {
      const response = await fetch(`/api/delivery/quote?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}&subtotal=${encodeURIComponent(subtotal)}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Endereço fora da cobertura de entrega.")
      setDeliveryQuote({ fee: Number(data.quote.fee || 0), label: String(data.quote.label || "Entrega"), distanceKm: data.quote.distanceKm == null ? null : Number(data.quote.distanceKm), durationMinutes: data.quote.durationMinutes == null ? null : Number(data.quote.durationMinutes) })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível calcular a entrega.")
      return false
    } finally { setQuoteBusy(false) }
  }

  type CepData = { cep: string; address: string; district: string; city: string; state: string; complement?: string; source?: string }

  async function fetchCep(cepValue: string): Promise<CepData> {
    const digits = cepValue.replace(/\D/g, "").slice(0, 8)
    const response = await fetch(`/api/address/cep?cep=${encodeURIComponent(digits)}`, { cache: "no-store" })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "CEP não encontrado.")
    return data as CepData
  }

  async function enrichGoogleAddressWithCep(address: GoogleAddress) {
    if (!address.zipCode || (address.address && address.district)) return address
    try {
      const data = await fetchCep(address.zipCode)
      return {
        ...address,
        address: address.address || data.address || "",
        district: address.district || data.district || "",
        city: address.city || data.city || "",
        state: address.state || data.state || "",
        zipCode: address.zipCode || data.cep || "",
      }
    } catch {
      return address
    }
  }

  function applyResolvedAddress(current: Checkout, address?: GoogleAddress | null, preserveNumber = false) {
    if (!address) return current
    return {
      ...current,
      address: address.address || "",
      number: address.number || (preserveNumber ? current.number : ""),
      district: address.district || "",
      city: address.city || "",
      state: address.state || "",
      zipCode: address.zipCode ? formatCep(address.zipCode) : "",
    }
  }

  function selectGoogleAddress(selection: GoogleAddressSelection) {
    const address = selection.address
    setError("")
    setGpsAccuracy(null)
    setShowDeliveryMap(false)
    setCheckout((current) => ({
      ...applyResolvedAddress(current, address, false),
      address: address.address || selection.formattedAddress || "",
      latitude: selection.latitude,
      longitude: selection.longitude,
    }))
    setAddressNotice("✓ Endereço encontrado. Rua, bairro e CEP foram preenchidos automaticamente; confira o número.")
    void refreshDeliveryQuote(selection.latitude, selection.longitude)
  }

  async function lookupCep(cepValue: string) {
    const digits = cepValue.replace(/\D/g, "").slice(0, 8)
    if (digits.length !== 8) return
    const requestId = ++cepLookupIdRef.current
    setCepBusy(true); setError(""); setAddressNotice("")
    try {
      const data = await fetchCep(digits)
      if (requestId !== cepLookupIdRef.current) return
      setCheckout((current) => ({
        ...current,
        zipCode: formatCep(data.cep || digits),
        address: data.address || "",
        district: data.district || "",
        city: data.city || "",
        state: data.state || "",
        latitude: null,
        longitude: null,
      }))
      setGpsAccuracy(null); setDeliveryQuote(null)
      setAddressNotice(`✓ CEP encontrado${data.source ? ` via ${data.source}` : ""}. Rua e bairro preenchidos automaticamente.`)

      const query = [data.address, data.district, data.city, data.state, data.cep, "Brasil"].filter(Boolean).join(", ")
      if (query) {
        try {
          const result = await geocodeGoogleAddress(query)
          if (requestId !== cepLookupIdRef.current) return
          const googleAddress = result.address
          setCheckout((current) => ({
            ...current,
            address: data.address || googleAddress.address || current.address,
            district: data.district || googleAddress.district || current.district,
            city: data.city || googleAddress.city || current.city,
            state: data.state || googleAddress.state || current.state,
            zipCode: formatCep(data.cep || googleAddress.zipCode || digits),
            latitude: result.latitude,
            longitude: result.longitude,
          }))
          await refreshDeliveryQuote(result.latitude, result.longitude)
        } catch {
          // ViaCEP continua válido mesmo quando o Google não consegue refinar o CEP.
        }
      }
    } catch (err) {
      if (requestId === cepLookupIdRef.current) setError(err instanceof Error ? err.message : "Não foi possível consultar o CEP.")
    } finally {
      if (requestId === cepLookupIdRef.current) setCepBusy(false)
    }
  }

  function handleCepChange(value: string) {
    const formatted = formatCep(value)
    setCheckout((current) => ({ ...current, zipCode: formatted, latitude: null, longitude: null }))
    setGpsAccuracy(null); setDeliveryQuote(null); setAddressNotice(""); setShowDeliveryMap(false)
    if (cepTimerRef.current) window.clearTimeout(cepTimerRef.current)
    const digits = formatted.replace(/\D/g, "")
    if (digits.length === 8) {
      cepTimerRef.current = window.setTimeout(() => { void lookupCep(formatted) }, 250)
    } else {
      cepLookupIdRef.current += 1
      setCepBusy(false)
    }
  }

  async function locateAddress() {
    if (!checkout.address.trim() || !checkout.number.trim()) return setError("Preencha rua e número para confirmar a localização da entrega.")
    setQuoteBusy(true); setGpsAccuracy(null); setError("")
    try {
      const query = [checkout.address, checkout.number, checkout.district, checkout.city || settings.city, checkout.state || settings.state, checkout.zipCode, "Brasil"].filter(Boolean).join(", ")
      const result = await geocodeGoogleAddress(query)
      const completeAddress = await enrichGoogleAddressWithCep(result.address)
      setCheckout((current) => ({ ...applyResolvedAddress(current, completeAddress, true), latitude: result.latitude, longitude: result.longitude }))
      setAddressNotice("✓ Endereço confirmado. Rua, bairro e CEP foram atualizados automaticamente; confira os dados acima.")
      await refreshDeliveryQuote(result.latitude, result.longitude)
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível localizar a entrega.") } finally { setQuoteBusy(false) }
  }
  function useLocation() {
    if (!navigator.geolocation) return setError("Seu navegador não oferece localização.")
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return setError("A localização precisa exige HTTPS. Teste pelo endereço publicado no Railway ou em localhost.")
    }

    setLocationBusy(true); setError(""); setAddressNotice("Obtendo a melhor posição disponível do dispositivo…"); setDeliveryQuote(null)
    let best: GeolocationPosition | null = null
    let watchId: number | null = null
    let finished = false
    let timer: number | null = null

    const finish = async () => {
      if (finished) return
      finished = true
      if (timer != null) window.clearTimeout(timer)
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      if (!best) { setError("Não foi possível obter sua localização. Ative a localização precisa e permita o acesso no navegador."); setAddressNotice(""); setLocationBusy(false); return }

      const latitude = best.coords.latitude
      const longitude = best.coords.longitude
      const accuracy = Number.isFinite(best.coords.accuracy) ? best.coords.accuracy : null
      setGpsAccuracy(accuracy)

      try {
        let address = await reverseGeocodeGoogle(latitude, longitude)
        if (!address) throw new Error("Não foi possível identificar um endereço para esta posição.")
        address = await enrichGoogleAddressWithCep(address)
        setCheckout((current) => ({ ...applyResolvedAddress(current, address, false), latitude, longitude }))
        const precision = accuracy ? ` Precisão aproximada: ${Math.round(accuracy)} m.` : ""
        setAddressNotice(`✓ Localização atual encontrada. Rua, bairro e CEP preenchidos automaticamente.${precision} Confira o número e ajuste o pino se necessário.`)
        await refreshDeliveryQuote(latitude, longitude)
      } catch (err) {
        setCheckout((current) => ({ ...current, latitude, longitude }))
        setError(err instanceof Error ? `${err.message} O ponto foi marcado no mapa; confira o endereço.` : "O ponto foi marcado, mas não foi possível preencher o endereço automaticamente.")
      } finally {
        setLocationBusy(false)
      }
    }

    const success = (position: GeolocationPosition) => {
      if (finished) return
      if (!best || position.coords.accuracy < best.coords.accuracy) {
        best = position
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude
        const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null
        setGpsAccuracy(accuracy)
        // Move o mapa imediatamente a cada leitura melhor, sem esperar a geocodificação reversa.
        setCheckout((current) => ({ ...current, latitude, longitude }))
        setAddressNotice(accuracy ? `GPS localizado. Refinando precisão… ~${Math.round(accuracy)} m` : "GPS localizado. Refinando precisão…")
      }
      if (position.coords.accuracy <= 25) void finish()
    }

    const failure = (geoError: GeolocationPositionError) => {
      if (finished || best) return
      if (geoError.code === geoError.PERMISSION_DENIED) {
        finished = true
        if (timer != null) window.clearTimeout(timer)
        if (watchId != null) navigator.geolocation.clearWatch(watchId)
        setError("Permissão de localização negada. Autorize a localização precisa para este site nas configurações do navegador.")
        setAddressNotice("")
        setLocationBusy(false)
      }
    }

    watchId = navigator.geolocation.watchPosition(success, failure, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
    timer = window.setTimeout(() => { void finish() }, 10000)
  }

  async function setPreciseMapPosition(value: { latitude: number; longitude: number; address?: GoogleAddress | null }) {
    setGpsAccuracy(null); setError("")
    const address = value.address ? await enrichGoogleAddressWithCep(value.address) : null
    setCheckout((current) => ({ ...applyResolvedAddress(current, address, true), latitude: value.latitude, longitude: value.longitude }))
    if (address) setAddressNotice("✓ Endereço atualizado pelo ponto marcado: rua, bairro e CEP sincronizados automaticamente.")
    void refreshDeliveryQuote(value.latitude, value.longitude)
  }

  async function applyCoupon() {
    if (!checkout.couponCode.trim()) { setCouponDiscount(0); setCouponMessage(""); return }
    setCouponBusy(true); setCouponMessage("")
    try { const response = await fetch(`/api/coupons?code=${encodeURIComponent(checkout.couponCode)}&subtotal=${subtotal}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Cupom inválido."); setCouponDiscount(Number(data.discount || 0)); setCouponMessage(`Cupom aplicado: -${money(Number(data.discount || 0))}`) } catch (err) { setCouponDiscount(0); setCouponMessage(err instanceof Error ? err.message : "Cupom inválido.") } finally { setCouponBusy(false) }
  }

  function whatsappOrderUrl(order: Order) {
    const items = order.items.map((item) => {
      const modifiers = (item.modifiers || []).map((modifier) => `  + ${modifier.optionName}${modifier.included ? " (incluído)" : modifier.priceDelta > 0 ? ` (+${money(modifier.priceDelta)})` : ""}`).join("\n")
      return `${item.quantity}x ${item.name} - ${money(item.subtotal)}${modifiers ? `\n${modifiers}` : ""}`
    }).join("\n")
    const text = `Olá! Acabei de fazer o pedido ${order.code} (${order.reference}).\n\n${items}\n\nTotal: ${money(order.total)}\nRecebimento: ${new Date(order.requestedFor).toLocaleString("pt-BR")}\nTipo: ${order.type === "delivery" ? "Delivery" : "Retirada"}`
    return `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
  }

  async function shareStore() {
    const shareData = { title: settings.storeName, text: `Confira ${settings.storeName}`, url: window.location.href }
    try {
      if (navigator.share) await navigator.share(shareData)
      else if (navigator.clipboard) { await navigator.clipboard.writeText(window.location.href); window.alert("Link copiado para compartilhar.") }
    } catch {
      // O cancelamento do compartilhamento não precisa interromper a experiência.
    }
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault(); const date = checkout.scheduleDate; const time = checkout.scheduleTime
    if (!settings.acceptingOrders) return setError("Os pedidos online estão temporariamente pausados pela loja.")
    if (!isOpen && checkout.timing !== "scheduled") return setError("Estamos fora do expediente. Escolha um horário disponível para agendar o pedido.")
    if (!cart.length) return setError("Seu carrinho está vazio.")
    if (!checkout.name.trim() || !checkout.phone.trim()) return setError("Informe nome e telefone.")
    if (checkout.timing === "scheduled" && (!date || !time)) return setError("Escolha a data e o horário do agendamento.")
    if (checkout.type === "delivery" && (!checkout.address.trim() || !checkout.number.trim())) return setError("Informe endereço e número para delivery.")
    if (checkout.type === "delivery" && !deliveryQuote) return setError("Confirme a localização no mapa antes de finalizar.")
    setSending(true); setError("")
    try {
      const requestedFor = checkout.timing === "scheduled"
        ? zonedDateTime(date, time, organizationTimeZone).toISOString()
        : undefined
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: checkout.type, timing: checkout.timing, requestedFor, paymentMethod: checkout.paymentMethod, changeFor: checkout.paymentMethod === "cash" ? checkout.changeFor : "", notes: checkout.notes, couponCode: checkout.couponCode.trim() || undefined, customer: { name: checkout.name, phone: checkout.phone, address: checkout.address, number: checkout.number, district: checkout.district, city: checkout.city, state: checkout.state, zipCode: checkout.zipCode, complement: checkout.complement, latitude: checkout.latitude, longitude: checkout.longitude }, items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        modifierOptionIds: item.optionIds,
      })) }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível enviar o pedido.")
      if (customer) await fetch("/api/client/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: checkout.name, phone: checkout.phone, defaultAddress: checkout.address, defaultNumber: checkout.number, defaultDistrict: checkout.district, defaultCity: checkout.city, defaultState: checkout.state, defaultZipCode: checkout.zipCode, defaultComplement: checkout.complement, defaultLatitude: checkout.latitude, defaultLongitude: checkout.longitude }) }).catch(() => null)
      localStorage.setItem("saborflow_last_order", data.order.reference); localStorage.removeItem("cris_last_order"); localStorage.removeItem("crisflow_cart_v1"); localStorage.removeItem(cartStorageKey); setCart([]); setCheckoutOpen(false); setCreatedOrder(data.order)
      if (settings.checkoutAfterSubmit === "whatsapp") window.location.href = whatsappOrderUrl(data.order)
      else if (settings.checkoutAfterSubmit === "site") router.push(orderPath(data.order.reference))
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao enviar pedido.") } finally { setSending(false) }
  }

  const themeStyle = { "--primary": settings.primaryColor, "--secondary": settings.secondaryColor, "--store-bg": settings.backgroundColor } as React.CSSProperties
  const activePaymentMethods: Array<[Checkout["paymentMethod"], string]> = []
  if (settings.pixEnabled) activePaymentMethods.push(["pix", "PIX"]); if (settings.cashEnabled) activePaymentMethods.push(["cash", "Dinheiro"]); if (settings.cardEnabled) activePaymentMethods.push(["card", "Cartão na entrega"])
  const publicAddress = [settings.address, settings.storeDistrict, settings.city, settings.state, settings.zipCode].filter(Boolean).join(", ")
  const todayDay = new Date().getDay()
  const socialButtonClass = "flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow"

  return (
    <div style={{ ...themeStyle, backgroundColor: settings.backgroundColor }} className="min-h-screen text-gray-950">
      {settings.clientAccountsEnabled && (
        <header className="border-b border-black/5 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-4 py-2 sm:px-6">
            <button onClick={() => setAccountOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 shadow-sm"><UserRound className="h-4 w-4" /><span>{customer ? customer.name.split(" ")[0] : "Entrar"}</span>{customer && settings.loyaltyEnabled && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-700">{customer.loyaltyPoints} pts</span>}</button>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-7xl px-4 pb-28 sm:px-6">
        <section className="pt-4 sm:pt-5">
          <div className="relative h-44 overflow-hidden rounded-[28px] sm:h-56 lg:h-64" style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})` }}>
            {settings.coverImage ? <img src={settings.coverImage} alt={`Capa de ${settings.storeName}`} className="h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-white"><div><p className="text-sm font-black uppercase tracking-[0.2em] text-white/80">{settings.systemName}</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">{settings.welcomeTitle}</h2><p className="mx-auto mt-2 max-w-2xl text-sm text-white/85">{settings.welcomeText}</p></div></div>}
          </div>

          <div className="relative px-1 sm:px-5">
            <div className="-mt-8 grid gap-4 sm:-mt-10 lg:grid-cols-[auto_1fr_auto] lg:items-end">
              <div className="relative z-10 w-fit rounded-[24px] bg-white p-1.5 shadow-sm ring-1 ring-black/5">
                {settings.logoImage ? <img src={settings.logoImage} alt={settings.storeName} className="h-24 w-24 rounded-[20px] object-cover sm:h-32 sm:w-32" /> : <div style={{ backgroundColor: settings.primaryColor }} className="flex h-24 w-24 items-center justify-center rounded-[20px] text-5xl text-white sm:h-32 sm:w-32">🥟</div>}
              </div>

              <div className="min-w-0 pb-1 lg:pb-2">
                <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{settings.storeName}</h1><span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-black ${isOpen ? "border-emerald-200 bg-emerald-50 text-emerald-800" : settings.acceptingOrders ? "border-amber-200 bg-amber-50 text-amber-800" : "border-gray-200 bg-gray-100 text-gray-600"}`}><span className={`h-2 w-2 rounded-full ${isOpen ? "bg-emerald-500" : settings.acceptingOrders ? "bg-amber-500" : "bg-gray-400"}`}/>{isOpen ? "Aberto" : settings.acceptingOrders ? "Fechado · aceitando agendamentos" : "Pedidos pausados"}</span></div>
                {settings.slogan && <p className="mt-1 text-sm text-gray-500">{settings.slogan}</p>}
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0"/><span>{settings.address}{settings.storeDistrict ? `, ${settings.storeDistrict}` : ""}{settings.city ? `, ${settings.city}` : ""}{settings.state ? ` - ${settings.state}` : ""}{settings.zipCode ? `, ${settings.zipCode}` : ""}</span></p>
                  <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 shrink-0"/><span>Entrega <strong>{settings.deliveryMinMinutes}–{settings.deliveryMaxMinutes} min.</strong></span></p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pb-1 lg:max-w-[310px] lg:justify-end lg:pb-2">
                {(settings.whatsappUrl || settings.whatsapp) && <a href={externalUrl(settings.whatsappUrl) || `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow"><MessageCircle className="h-5 w-5"/></a>}
                {settings.instagramUrl && <a href={externalUrl(settings.instagramUrl)} target="_blank" rel="noreferrer" aria-label="Instagram" className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow"><InstagramBrandIcon className="h-5 w-5"/></a>}
                {settings.facebookUrl && <a href={externalUrl(settings.facebookUrl)} target="_blank" rel="noreferrer" aria-label="Facebook" className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow"><FacebookBrandIcon className="h-5 w-5"/></a>}
                {settings.tiktokUrl && <a href={externalUrl(settings.tiktokUrl)} target="_blank" rel="noreferrer" aria-label="TikTok" className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-black text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow">♪</a>}
                {settings.youtubeUrl && <a href={externalUrl(settings.youtubeUrl)} target="_blank" rel="noreferrer" aria-label="YouTube" className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow"><YouTubeBrandIcon className="h-5 w-5"/></a>}
                {settings.websiteUrl && <a href={externalUrl(settings.websiteUrl)} target="_blank" rel="noreferrer" aria-label="Site" className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow"><Globe2 className="h-5 w-5"/></a>}
                <button type="button" onClick={() => setInfoOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 shadow-sm"><Info className="h-4 w-4"/>Sobre a loja</button>
              </div>
            </div>
          </div>
        </section>

        <section className="sticky top-0 z-20 -mx-4 mt-5 border-y border-black/5 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto">
            <label className="relative min-w-[190px] max-w-xs flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="O que você procura?" className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-orange-100"/></label>
            <div className="flex gap-1">{["Todos", ...categories.filter((item) => item.active).map((item) => item.name)].map((item) => <button key={item} onClick={() => setCategory(item)} style={category === item ? { borderColor: settings.primaryColor, color: settings.primaryColor } : undefined} className={`h-11 whitespace-nowrap border-b-2 px-3 text-sm font-black ${category === item ? "bg-white" : "border-transparent text-gray-700 hover:bg-gray-50"}`}>{item}</button>)}</div>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-2xl font-black">{category === "Todos" ? "Cardápio" : category}</h2><p className="text-sm text-gray-500">{filtered.length} produto(s) disponíveis</p></div></div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((product) => {
              const quantity = quantityFor(product.id)
              const hasModifiers = productHasModifiers(product)
              const unavailable =
                (product.trackStock && product.stock <= 0) ||
                product.ingredientStockAvailable === false

              return (
                <article key={product.id} className="group min-w-0">
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-black/5">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-6xl">🥟</span>
                    )}

                    {!unavailable && hasModifiers && (
                      <button
                        aria-label={`Montar ${product.name}`}
                        onClick={() => setCustomizingProduct(product)}
                        style={{ backgroundColor: settings.primaryColor }}
                        className="absolute bottom-2 right-2 flex h-10 items-center justify-center gap-1 rounded-xl px-3 text-xs font-black text-white shadow-lg"
                      >
                        <Plus className="h-4 w-4" /> Montar
                      </button>
                    )}

                    {!unavailable && !hasModifiers && (
                      quantity === 0 ? (
                        <button
                          aria-label={`Adicionar ${product.name}`}
                          onClick={() => setSimpleProductQuantity(product, 1)}
                          style={{ backgroundColor: settings.primaryColor }}
                          className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      ) : (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-xl bg-white p-1 shadow-lg">
                          <button onClick={() => setSimpleProductQuantity(product, quantity - 1)} className="rounded-lg p-1.5 hover:bg-gray-100"><Minus className="h-4 w-4" /></button>
                          <strong className="min-w-5 text-center text-sm">{quantity}</strong>
                          <button onClick={() => setSimpleProductQuantity(product, quantity + 1)} className="rounded-lg p-1.5 hover:bg-gray-100"><Plus className="h-4 w-4" /></button>
                        </div>
                      )
                    )}

                    {unavailable && (
                      <span className="absolute inset-x-2 bottom-2 rounded-lg bg-white/95 px-2 py-1.5 text-center text-xs font-black text-gray-500 shadow">
                        Indisponível
                      </span>
                    )}
                    {product.featured && <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-black shadow">Destaque</span>}
                    {hasModifiers && quantity > 0 && (
                      <span className="absolute right-2 top-2 rounded-full bg-gray-950 px-2 py-1 text-[10px] font-black text-white shadow">{quantity} no carrinho</span>
                    )}
                  </div>
                  <div className="pt-2">
                    <strong className="text-base">{money(product.price)}</strong>
                    {hasModifiers && <span className="ml-1 text-[10px] font-bold text-gray-400">+ adicionais</span>}
                    <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug">{product.name}</h3>
                    {product.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{product.description}</p>}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </main>

      {totalItems > 0 && <button onClick={() => setCartOpen(true)} className="fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between rounded-2xl bg-gray-950 px-4 py-3 text-white shadow-2xl"><span className="flex items-center gap-3"><span style={{ backgroundColor: settings.primaryColor }} className="flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-black">{totalItems}</span><span className="text-left"><small className="block text-[10px] uppercase tracking-wide text-gray-400">Seu pedido</small><strong>{money(subtotal)}</strong></span></span><span className="flex items-center gap-1 text-sm font-bold">Ver carrinho <ChevronRight className="h-4 w-4" /></span></button>}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 sm:items-center sm:p-4">
          <button aria-label="Fechar" onClick={() => setCartOpen(false)} className="absolute inset-0" />
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-xl font-black">Seu carrinho</h2><p className="text-sm text-gray-500">Confira antes de continuar.</p></div>
              <button onClick={() => setCartOpen(false)} className="rounded-xl bg-gray-100 p-2"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.key} className="rounded-2xl border border-gray-100 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-orange-50">
                      {item.product.image ? <img src={item.product.image} alt="" className="h-full w-full object-cover" /> : "🥟"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{item.product.name}</p>
                      <p className="text-xs text-gray-500">{money(item.unitPrice)} cada</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-gray-100 p-1">
                      <button onClick={() => setCartItemQuantity(item.key, item.quantity - 1)} className="p-1"><Minus className="h-4 w-4" /></button>
                      <strong className="min-w-5 text-center text-sm">{item.quantity}</strong>
                      <button onClick={() => setCartItemQuantity(item.key, item.quantity + 1)} className="p-1"><Plus className="h-4 w-4" /></button>
                    </div>
                    <strong className="w-20 text-right text-sm">{money(item.unitPrice * item.quantity)}</strong>
                  </div>
                  {item.modifiers.length > 0 && (
                    <div className="ml-[60px] mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      {item.modifiers.map((modifier) => (
                        <p key={`${modifier.groupId}-${modifier.optionId}`}>
                          <span className="font-bold">{modifier.groupName}:</span> {modifier.optionName}
                          {modifier.priceDelta > 0 ? ` (+${money(modifier.priceDelta)})` : modifier.included ? " (incluído)" : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="my-5 flex items-center justify-between border-t border-gray-100 pt-4"><span className="font-semibold text-gray-500">Subtotal</span><strong className="text-xl">{money(subtotal)}</strong></div>
            <button disabled={!settings.acceptingOrders} onClick={() => { setCartOpen(false); setCheckout((current) => isOpen ? current : { ...current, timing: "scheduled", scheduleDate: "", scheduleTime: "" }); setCheckoutOpen(true) }} style={{ backgroundColor: settings.primaryColor }} className="h-12 w-full rounded-xl font-black text-white disabled:opacity-50">{!settings.acceptingOrders ? "Pedidos temporariamente pausados" : isOpen ? "Escolher recebimento" : "Agendar pedido"}</button>
          </div>
        </div>
      )}

      {checkoutOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 sm:items-center sm:p-4"><button aria-label="Fechar" onClick={() => setCheckoutOpen(false)} className="absolute inset-0" /><form onSubmit={submitOrder} className="relative max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-black">Finalizar pedido</h2><p className="text-sm text-gray-500">Poucos passos e o pedido já entra na cozinha.</p></div><button type="button" onClick={() => setCheckoutOpen(false)} className="rounded-xl bg-gray-100 p-2"><X className="h-5 w-5" /></button></div>{error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</div>}<div className="space-y-5">
        <section><div className="mb-3 flex items-center justify-between"><h3 className="font-black">1. Seus dados</h3>{settings.clientAccountsEnabled && <button type="button" onClick={() => setAccountOpen(true)} className="inline-flex items-center gap-1 text-xs font-black text-orange-600"><LogIn className="h-3.5 w-3.5" />{customer ? "Conta conectada" : "Entrar com CPF"}</button>}</div><div className="grid gap-3 sm:grid-cols-2"><input required value={checkout.name} onChange={(e) => setCheckout({ ...checkout, name: e.target.value })} placeholder="Seu nome *" className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none"/><input required value={checkout.phone} onChange={(e) => setCheckout({ ...checkout, phone: e.target.value })} placeholder="WhatsApp *" className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none"/></div></section>
        <section><h3 className="mb-3 font-black">2. Como vai receber?</h3><div className="grid gap-3 sm:grid-cols-2">{settings.pickupEnabled && <button type="button" onClick={() => { setCheckout({ ...checkout, type: "pickup", scheduleTime: "" }); setShowDeliveryMap(false) }} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${checkout.type === "pickup" ? "border-orange-400 bg-orange-50" : "border-gray-200"}`}><Store className="h-5 w-5"/><span><strong className="block">Retirada</strong><small className="text-gray-500">Buscar no estabelecimento</small></span>{checkout.type === "pickup" && <Check className="ml-auto h-5 w-5 text-orange-600"/>}</button>}{settings.deliveryEnabled && <button type="button" onClick={() => { setCheckout({ ...checkout, type: "delivery", scheduleTime: "" }); setShowDeliveryMap(false) }} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${checkout.type === "delivery" ? "border-orange-400 bg-orange-50" : "border-gray-200"}`}><Bike className="h-5 w-5"/><span><strong className="block">Delivery</strong><small className="text-gray-500">Taxa calculada automaticamente</small></span>{checkout.type === "delivery" && <Check className="ml-auto h-5 w-5 text-orange-600"/>}</button>}</div></section>
        <section><h3 className="mb-3 flex items-center gap-2 font-black"><CalendarDays className="h-5 w-5 text-orange-500" />3. Tipo de pedido</h3><div className="space-y-3">{!isOpen && settings.acceptingOrders && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Loja fora do expediente</p><p className="mt-1 text-sm font-bold text-amber-950">Você pode fazer o pedido normalmente. Ele será recebido como agendado para um horário disponível do expediente.</p></div>}<label><span className="mb-1 block text-[11px] font-black uppercase text-gray-500">Quando quer receber?</span><select value={checkout.timing} onChange={(e) => setCheckout({ ...checkout, timing: e.target.value as Checkout["timing"], scheduleDate: "", scheduleTime: "" })} className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold">{isOpen && <option value="now">Para agora</option>}<option value="scheduled">{isOpen ? "Quero agendar o pedido" : "Pedido agendado (fora do expediente)"}</option></select></label>{checkout.timing === "now" ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-700">{checkout.type === "delivery" ? "Entrega para agora" : "Retirada para agora"}</p><p className="mt-1 text-lg font-black text-emerald-950">{checkout.type === "delivery" ? `Previsão de ${IMMEDIATE_DELIVERY_MIN_MINUTES} a ${IMMEDIATE_DELIVERY_MAX_MINUTES} minutos` : `Previsão de aproximadamente ${settings.pickupLeadMinutes} minutos`}</p><p className="mt-1 text-xs text-emerald-800">O pedido entra imediatamente na fila após a confirmação.</p></div> : <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4"><p className="mb-3 text-xs font-black uppercase text-blue-700">Agendar pedido · até {schedulingDaysAhead} dias</p><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-[11px] font-black uppercase text-gray-500">Data</span><input type="date" required min={scheduleMinDate} max={scheduleMaxDate} value={selectedDate} onChange={(e) => setCheckout({ ...checkout, scheduleDate: e.target.value, scheduleTime: "" })} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label><label><span className="mb-1 block text-[11px] font-black uppercase text-gray-500">Horário</span><select required disabled={!selectedDate || !timeSlots.length} value={selectedTime} onChange={(e) => setCheckout({ ...checkout, scheduleTime: e.target.value })} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:bg-gray-100"><option value="">{!selectedDate ? "Escolha a data primeiro" : timeSlots.length ? "Escolha o horário" : "Sem horários disponíveis"}</option>{timeSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label></div>{selectedDate && !timeSlots.length && <p className="mt-2 text-xs font-bold text-amber-700">Não há horários disponíveis nesta data. Escolha outro dia dentro dos próximos {schedulingDaysAhead} dias.</p>}</div>}</div></section>
        {checkout.type === "delivery" && <section><h3 className="mb-1 font-black">4. Endereço de entrega</h3><p className="mb-3 text-sm text-gray-500">Pesquise o endereço completo primeiro. Depois apenas confira CEP, rua, bairro e número. Cidade e estado são identificados automaticamente e ficam ocultos.</p><div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-2xl border border-blue-100 bg-blue-50/50 p-3"><p className="mb-2 text-[11px] font-black uppercase text-blue-700">Pesquisar localização completa</p><GoogleAddressAutocomplete onSelect={selectGoogleAddress} placeholder="Digite rua, número, estabelecimento ou CEP" biasCenter={{ lat: settings.storeLatitude, lng: settings.storeLongitude }} biasRadiusMeters={settings.maxDeliveryDistanceKm > 0 ? Math.max(10000, settings.maxDeliveryDistanceKm * 1200) : 50000} /><p className="mt-2 text-[11px] text-gray-500">Escolha uma sugestão e confirme os dados abaixo. Você também pode informar somente o CEP.</p></div>
          <label><span className="mb-1 block text-[11px] font-black uppercase text-gray-500">CEP</span><div className="relative"><input inputMode="numeric" autoComplete="postal-code" value={checkout.zipCode} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" className="h-11 w-full rounded-xl border border-gray-200 px-3 pr-20 text-sm outline-none"/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">{cepBusy ? "Buscando…" : "Automático"}</span></div></label>
          <label><span className="mb-1 block text-[11px] font-black uppercase text-gray-500">Bairro</span><input value={checkout.district} onChange={(e) => changeAddress({ district: e.target.value })} placeholder="Bairro" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none"/></label>
          <label className="sm:col-span-2"><span className="mb-1 block text-[11px] font-black uppercase text-gray-500">Rua / Avenida</span><input required value={checkout.address} onChange={(e) => changeAddress({ address: e.target.value })} placeholder="Rua / Avenida *" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none"/></label>
          <label><span className="mb-1 block text-[11px] font-black uppercase text-gray-500">Número</span><input required value={checkout.number} onChange={(e) => changeAddress({ number: e.target.value })} onBlur={() => { if (checkout.address.trim() && checkout.number.trim()) void locateAddress() }} placeholder="Número *" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"/></label>
          <label><span className="mb-1 block text-[11px] font-black uppercase text-gray-500">Complemento / referência</span><input value={checkout.complement} onChange={(e) => setCheckout({ ...checkout, complement: e.target.value })} placeholder="Casa, apto, referência..." className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"/></label>
          {(checkout.address || checkout.district || checkout.number) && <div className="sm:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[11px] font-black uppercase text-emerald-700">Confira o endereço</p><p className="mt-1 text-sm font-bold text-emerald-950">{[checkout.address, checkout.number, checkout.district, checkout.zipCode].filter(Boolean).join(", ")}</p><p className="mt-1 text-[11px] text-emerald-800">Se rua, bairro e número estiverem corretos, não é necessário abrir o mapa.</p></div>}
          {addressNotice && <p className="text-xs font-bold text-emerald-700 sm:col-span-2">{addressNotice}</p>}
          <button type="button" onClick={useLocation} disabled={locationBusy} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 text-sm font-bold text-blue-700 sm:col-span-2"><MapPin className="h-4 w-4"/>{locationBusy ? "Localizando e preenchendo endereço..." : "Usar minha localização atual"}</button>
          {checkout.latitude != null && checkout.longitude != null && <button type="button" onClick={() => setShowDeliveryMap((value) => !value)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 sm:col-span-2"><MapPin className="h-4 w-4"/>{showDeliveryMap ? "Ocultar mapa" : "Ver / ajustar localização no mapa"}</button>}
          {showDeliveryMap && checkout.latitude != null && checkout.longitude != null && <div className="sm:col-span-2"><DeliveryLocationMap latitude={checkout.latitude} longitude={checkout.longitude} accuracyMeters={gpsAccuracy} storeLatitude={settings.storeLatitude} storeLongitude={settings.storeLongitude} onPositionChange={setPreciseMapPosition} /></div>}
          {deliveryQuote && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800 sm:col-span-2">✓ {deliveryQuote.label} · Taxa {money(deliveryQuote.fee)}{deliveryQuote.distanceKm != null ? ` · ${deliveryQuote.distanceKm.toFixed(2).replace(".", ",")} km pelas ruas` : ""}</div>}
        </div></section>}
        <section><h3 className="mb-3 font-black">{checkout.type === "delivery" ? "5" : "4"}. Pagamento</h3><div className="grid gap-2 sm:grid-cols-3">{activePaymentMethods.map(([value, label]) => <button type="button" key={value} onClick={() => setCheckout({ ...checkout, paymentMethod: value })} className={`rounded-xl border px-3 py-3 text-sm font-bold ${checkout.paymentMethod === value ? "border-orange-400 bg-orange-50 text-orange-800" : "border-gray-200"}`}>{label}</button>)}</div>{checkout.paymentMethod === "cash" && <input value={checkout.changeFor} onChange={(e) => setCheckout({ ...checkout, changeFor: e.target.value })} placeholder="Troco para quanto?" className="mt-3 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"/>}</section>
        <section><h3 className="mb-2 font-black">Cupom</h3><div className="flex gap-2"><input value={checkout.couponCode} onChange={(e) => { setCheckout({ ...checkout, couponCode: e.target.value.toUpperCase() }); setCouponDiscount(0); setCouponMessage("") }} placeholder="Ex.: BEMVINDO10" className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-sm uppercase"/><button type="button" onClick={applyCoupon} disabled={couponBusy || !checkout.couponCode.trim()} className="rounded-xl bg-gray-100 px-4 text-sm font-black">{couponBusy ? "..." : "Aplicar"}</button></div>{couponMessage && <p className={`mt-2 text-xs font-bold ${couponDiscount > 0 ? "text-emerald-700" : "text-red-600"}`}>{couponMessage}</p>}</section>
        <section><h3 className="mb-2 font-black">Observações</h3><textarea value={checkout.notes} onChange={(e) => setCheckout({ ...checkout, notes: e.target.value })} placeholder="Ex.: sem molho, tocar interfone..." rows={3} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"/></section>
        <section className="rounded-2xl bg-gray-50 p-4"><div className="flex justify-between text-sm text-gray-600"><span>Produtos</span><span>{money(subtotal)}</span></div>{couponDiscount > 0 && <div className="mt-2 flex justify-between text-sm font-bold text-emerald-700"><span>Desconto</span><span>-{money(couponDiscount)}</span></div>}{checkout.type === "delivery" && <div className="mt-2 flex justify-between text-sm text-gray-600"><span>Taxa de entrega</span><span>{deliveryQuote ? money(deliveryFee) : "A calcular"}</span></div>}<div className="mt-3 flex justify-between border-t border-gray-200 pt-3"><strong>Total</strong><strong className="text-xl">{money(total)}</strong></div></section>
        <button disabled={sending || !settings.acceptingOrders || (!isOpen && checkout.timing !== "scheduled") || (checkout.timing === "scheduled" && (!selectedDate || !selectedTime)) || (checkout.type === "delivery" && !deliveryQuote)} style={{ backgroundColor: settings.primaryColor }} className="h-12 w-full rounded-xl font-black text-white disabled:opacity-50">{sending ? "Enviando pedido..." : `Confirmar pedido · ${money(total)}`}</button>
      </div></form></div>}

      {infoOpen && <div className="fixed inset-0 z-[92] bg-slate-950/50">
        <button aria-label="Fechar informações da loja" className="absolute inset-0" onClick={() => setInfoOpen(false)}/>
        <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 sm:px-6">
            <h2 className="text-xl font-black">Sobre a loja</h2>
            <button onClick={() => setInfoOpen(false)} aria-label="Fechar" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100"><X className="h-5 w-5"/></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-8 sm:px-6">
            <div className="flex items-start justify-between gap-4 py-5">
              <div className="min-w-0">
                <h3 className="truncate text-2xl font-black uppercase tracking-tight">{settings.storeName}</h3>
                {settings.slogan && <p className="mt-1 text-sm text-gray-500">{settings.slogan}</p>}
              </div>
              {settings.logoImage ? <img src={settings.logoImage} alt={`Logo de ${settings.storeName}`} className="h-14 w-14 shrink-0 rounded-xl border border-gray-200 object-cover"/> : <div style={{ backgroundColor: settings.primaryColor }} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl text-white">🍽️</div>}
            </div>

            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-5">
              {(settings.whatsappUrl || settings.whatsapp) && <a href={externalUrl(settings.whatsappUrl) || `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className={socialButtonClass}><MessageCircle className="h-5 w-5"/></a>}
              {settings.instagramUrl && <a href={externalUrl(settings.instagramUrl)} target="_blank" rel="noreferrer" aria-label="Instagram" className={socialButtonClass}><InstagramBrandIcon className="h-5 w-5"/></a>}
              {settings.facebookUrl && <a href={externalUrl(settings.facebookUrl)} target="_blank" rel="noreferrer" aria-label="Facebook" className={socialButtonClass}><FacebookBrandIcon className="h-5 w-5"/></a>}
              {settings.tiktokUrl && <a href={externalUrl(settings.tiktokUrl)} target="_blank" rel="noreferrer" aria-label="TikTok" className={`${socialButtonClass} text-base font-black`}>♪</a>}
              {settings.youtubeUrl && <a href={externalUrl(settings.youtubeUrl)} target="_blank" rel="noreferrer" aria-label="YouTube" className={socialButtonClass}><YouTubeBrandIcon className="h-5 w-5"/></a>}
              {settings.websiteUrl && <a href={externalUrl(settings.websiteUrl)} target="_blank" rel="noreferrer" aria-label="Site" className={socialButtonClass}><Globe2 className="h-5 w-5"/></a>}
              <button type="button" onClick={() => void shareStore()} aria-label="Compartilhar" title="Compartilhar" className={socialButtonClass}><ExternalLink className="h-5 w-5"/></button>
            </div>

            <section className="border-b border-gray-200 py-5">
              <h4 className="text-lg font-black">Endereço</h4>
              <div className="mt-3 flex items-start gap-3">
                <MapPin style={{ color: settings.primaryColor }} className="mt-0.5 h-6 w-6 shrink-0"/>
                <p className="text-base font-semibold leading-relaxed text-gray-800">{publicAddress || "Endereço não informado."}</p>
              </div>
            </section>

            <section className="border-b border-gray-200 py-5">
              <h4 className="text-lg font-black">Tipos de serviço</h4>
              <div className="mt-4 space-y-2">
                {settings.deliveryEnabled && <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3 px-4 py-3"><Bike style={{ color: settings.primaryColor }} className="h-6 w-6"/><strong className="text-lg">Delivery</strong><Check className="ml-auto h-5 w-5"/></div>
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    <p className="flex items-center gap-2"><Clock3 className="h-4 w-4"/>Tempo de entrega em casa <strong className="text-gray-900">{settings.deliveryMinMinutes} – {settings.deliveryMaxMinutes} min.</strong></p>
                    <p className="mt-2 text-xs">Cobertura e taxa são calculadas automaticamente conforme o endereço informado.</p>
                  </div>
                </div>}
                {settings.pickupEnabled && <div className="rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-3"><Store style={{ color: settings.primaryColor }} className="h-6 w-6"/><div><strong className="text-lg">Retirada</strong><p className="text-xs text-gray-500">Previsão mínima de {settings.pickupLeadMinutes} min.</p></div><Check className="ml-auto h-5 w-5"/></div>
                </div>}
                {settings.dineInEnabled && <div className="rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-3"><Store style={{ color: settings.primaryColor }} className="h-6 w-6"/><strong className="text-lg">No local</strong><Check className="ml-auto h-5 w-5"/></div>
                </div>}
                {!settings.deliveryEnabled && !settings.pickupEnabled && !settings.dineInEnabled && <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Nenhum tipo de serviço público está habilitado nas configurações.</p>}
              </div>
            </section>

            <section className="py-5">
              <h4 className="text-lg font-black">Horário de funcionamento</h4>
              <div className="mt-4 space-y-1">
                {settings.businessHours.map((item) => {
                  const active = item.day === todayDay
                  return <div key={item.day} style={active ? { backgroundColor: `${settings.primaryColor}12`, color: settings.primaryColor } : undefined} className={`flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-sm ${active ? "font-black" : "text-gray-700"}`}>
                    <span>{item.label}</span>
                    <span className="flex items-center gap-2 whitespace-nowrap"><Clock3 className="h-4 w-4"/>{item.enabled ? `${item.open} – ${item.close}` : "Fechado"}</span>
                  </div>
                })}
              </div>
            </section>

            {settings.phone && <section className="border-t border-gray-200 py-5"><h4 className="text-lg font-black">Contato</h4><p className="mt-2 flex items-center gap-2 text-sm text-gray-700"><MessageCircle className="h-4 w-4"/>{settings.phone}</p></section>}
          </div>
        </aside>
      </div>}

      <ProductCustomizer
        product={customizingProduct}
        primaryColor={settings.primaryColor}
        onClose={() => setCustomizingProduct(null)}
        onConfirm={(customization) => {
          if (customizingProduct) addCustomizedProduct(customizingProduct, customization)
        }}
      />

      <ClientAccountModal open={accountOpen} onClose={() => setAccountOpen(false)} customer={customer} onCustomer={setCustomer} />

      <StoreChatbot settings={settings} />

      {createdOrder && settings.checkoutAfterSubmit === "ask" && <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div><h2 className="mt-4 text-center text-2xl font-black">Pedido confirmado!</h2><p className="mt-2 text-center text-sm text-gray-500">{createdOrder.code} · escolha como quer continuar.</p><div className="mt-5 grid gap-3"><a href={whatsappOrderUrl(createdOrder)} className="flex h-12 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white">Enviar resumo no WhatsApp</a><button onClick={() => router.push(orderPath(createdOrder.reference))} className="h-12 rounded-xl bg-gray-950 text-sm font-black text-white">Acompanhar pedido no site</button></div></div></div>}
    </div>
  )
}
