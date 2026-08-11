import { promises as fs } from "node:fs"
import path from "node:path"
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { defaultBusinessHours, isStoreOpenNow, isWithinBusinessHours } from "@/lib/operations"
import { calculateDeliveryQuote } from "@/lib/delivery-pricing"
import { assertDeliveryZoneValid, deliveryZoneColor, nextDeliveryZoneColor } from "@/lib/delivery-zone-geometry"
import { IMMEDIATE_DELIVERY_MAX_MINUTES, MAX_SCHEDULING_DAYS } from "@/lib/order-timing"
import { syncCurrentDeploymentProductStocks } from "@/lib/catalog-db"
import { syncCurrentDeploymentOrderFromLegacy } from "@/lib/order-db"
import type {
  CashSession,
  Category,
  Coupon,
  Courier,
  CustomerAccount,
  CustomerSummary,
  DashboardSummary,
  DeliveryZone,
  Feedback,
  FinancialEntry,
  StaffMember,
  Order,
  Product,
  StoreData,
  StoreSettings,
} from "@/lib/types"

const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), "data", "store.json")
let mutationQueue: Promise<void> = Promise.resolve()

const defaultSettings: StoreSettings = {
  storeName: "Cris Salgados",
  systemName: "SaborFlow",
  slogan: "Sabor e qualidade em cada pedido",
  welcomeTitle: "Peça seus salgados do seu jeito",
  welcomeText: "Escolha os produtos, agende o melhor horário e acompanhe seu pedido em tempo real.",
  phone: "(99) 98456-7999",
  whatsapp: "5599984567999",
  whatsappUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  tiktokUrl: "",
  youtubeUrl: "",
  websiteUrl: "",
  address: "Rua Galeão, 30",
  storeDistrict: "Santos Dumont",
  city: "Bacabal",
  state: "MA",
  zipCode: "65700-000",
  storeLatitude: -4.225,
  storeLongitude: -44.786,
  acceptingOrders: true,
  pickupEnabled: true,
  deliveryEnabled: true,
  dineInEnabled: false,
  deliveryFee: 0,
  deliveryPricingMode: "customAreas",
  fixedDeliveryFee: 5,
  distanceBaseFee: 3,
  distanceFeePerKm: 1.5,
  maxDeliveryDistanceKm: 10,
  freeDeliveryAbove: 0,
  deliveryDistanceBands: [
    { id: "band-1", minKm: 0, maxKm: 3, fee: 5, active: true },
    { id: "band-2", minKm: 3.01, maxKm: 6, fee: 8, active: true },
    { id: "band-3", minKm: 6.01, maxKm: 10, fee: 12, active: true },
  ],
  minimumOrder: 0,
  estimatedMinutes: 45,
  deliveryMinMinutes: 30,
  deliveryMaxMinutes: 50,
  pickupLeadMinutes: 30,
  slotIntervalMinutes: 15,
  schedulingDaysAhead: 60,
  checkoutTimingVersion: 1,
  pixKey: "",
  openingHours: "Seg a Sáb · 08:00 às 20:00",
  businessHours: defaultBusinessHours,
  pickupInstructions: "Retire seu pedido no balcão informando o nome e o número do pedido.",
  primaryColor: "#f97316",
  secondaryColor: "#dc2626",
  backgroundColor: "#fffaf5",
  logoImage: "",
  coverImage: "",
  googleReviewUrl: "",
  googleBusinessUrl: "",
  checkoutAfterSubmit: "ask",
  clientAccountsEnabled: true,
  rememberClientDays: 90,
  loyaltyEnabled: true,
  loyaltyPointsPerReal: 1,
  loyaltyRewardText: "Troque seus pontos por benefícios definidos pela loja.",
  loyaltyRewardPoints: 100,
  autoPrintNewOrders: false,
  printerName: "",
  printCopies: 1,
  printKitchenTicket: true,
  printCustomerTicket: false,
  whatsappBulkEnabled: false,
  chatbotEnabled: true,
  chatbotGreeting: "Olá! 👋 Posso te ajudar com horário, entrega, pagamento ou atendimento pelo WhatsApp.",
  cashRegisterEnabled: true,
  fiscalEnabled: false,
  fiscalProviderUrl: "",
  totemEnabled: false,
  googleAnalyticsId: "",
  metaPixelId: "",
  cardEnabled: true,
  cashEnabled: true,
  pixEnabled: true,
}

function ensureSequence(data: Partial<StoreData>, key: keyof StoreData["sequence"], ids: number[]) {
  return Math.max(Number(data.sequence?.[key] || 0), ...ids, 0)
}

function normalizeStore(raw: Partial<StoreData>): StoreData {
  const needsTimingMigration = Number(raw.settings?.checkoutTimingVersion || 0) < 1
  const settings: StoreSettings = {
    ...defaultSettings,
    ...(raw.settings || {}),
    systemName: "SaborFlow",
    ...(needsTimingMigration ? { deliveryMinMinutes: 30, deliveryMaxMinutes: 50, schedulingDaysAhead: 60, checkoutTimingVersion: 1 } : { checkoutTimingVersion: 1 }),
    businessHours: Array.isArray(raw.settings?.businessHours) && raw.settings.businessHours.length
      ? raw.settings.businessHours
      : defaultBusinessHours,
    deliveryDistanceBands: Array.isArray(raw.settings?.deliveryDistanceBands) && raw.settings.deliveryDistanceBands.length
      ? raw.settings.deliveryDistanceBands.map((band, index) => ({
          id: String(band.id || `band-${index + 1}`),
          minKm: Math.max(0, Number(band.minKm || 0)),
          maxKm: Math.max(0, Number(band.maxKm || 0)),
          fee: Math.max(0, Number(band.fee || 0)),
          active: band.active ?? true,
        }))
      : defaultSettings.deliveryDistanceBands,
  }

  const products: Product[] = Array.isArray(raw.products)
    ? raw.products.map((product) => ({
        ...product,
        featured: product.featured ?? false,
        image: product.image ?? "",
        trackStock: product.trackStock ?? false,
        stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0,
        minStock: Number.isFinite(Number(product.minStock)) ? Number(product.minStock) : 0,
      }))
    : []

  const now = new Date().toISOString()
  const categoryNames = Array.from(new Set(products.map((product) => product.category).filter(Boolean)))
  const categories: Category[] = Array.isArray(raw.categories) && raw.categories.length
    ? raw.categories
    : categoryNames.map((name, index) => ({ id: index + 1, name, active: true, sortOrder: index + 1, createdAt: now, updatedAt: now }))

  const deliveryZones: DeliveryZone[] = Array.isArray(raw.deliveryZones)
    ? raw.deliveryZones.map((zone, index) => ({
        ...zone,
        color: deliveryZoneColor(zone.color, index),
        shape: zone.shape === "polygon" && Array.isArray(zone.points) && zone.points.length >= 3 ? "polygon" : "circle",
        points: Array.isArray(zone.points) ? zone.points.map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)) : [],
        centerLat: Number(zone.centerLat),
        centerLng: Number(zone.centerLng),
        radiusMeters: Math.max(50, Number(zone.radiusMeters || 0)),
        fee: Math.max(0, Number(zone.fee || 0)),
        active: zone.active ?? true,
      }))
    : []

  const couriers: Courier[] = Array.isArray(raw.couriers)
    ? raw.couriers.map((courier) => ({ ...courier, vehicle: courier.vehicle || "", active: courier.active ?? true }))
    : []

  const orders: Order[] = Array.isArray(raw.orders)
    ? raw.orders.map((order) => {
        const created = new Date(order.createdAt)
        const fallbackMinutes = order.type === "delivery" ? settings.deliveryMaxMinutes : settings.pickupLeadMinutes
        const fallbackRequested = new Date(created.getTime() + fallbackMinutes * 60000).toISOString()
        return {
          ...order,
          status: order.status || "pending",
          subtotal: Number.isFinite(Number(order.subtotal)) ? Number(order.subtotal) : Number(order.total || 0),
          discount: Number.isFinite(Number(order.discount)) ? Number(order.discount) : 0,
          deliveryFee: Number.isFinite(Number(order.deliveryFee)) ? Number(order.deliveryFee) : 0,
          requestedFor: order.requestedFor || fallbackRequested,
          scheduled: order.scheduled ?? false,
        }
      })
    : []

  const customerAccounts = Array.isArray(raw.customerAccounts) ? raw.customerAccounts : []
  const feedbacks = Array.isArray(raw.feedbacks) ? raw.feedbacks : []
  const coupons = Array.isArray(raw.coupons) ? raw.coupons : []
  const cashSessions = Array.isArray(raw.cashSessions) ? raw.cashSessions : []
  const financialEntries = Array.isArray(raw.financialEntries) ? raw.financialEntries : []
  const staffMembers: StaffMember[] = Array.isArray(raw.staffMembers) ? raw.staffMembers.map((member) => ({ ...member, permissions: Array.isArray(member.permissions) ? member.permissions : [], active: member.active ?? true })) : []

  return {
    products,
    categories,
    orders,
    deliveryZones,
    couriers,
    customerAccounts,
    feedbacks,
    coupons,
    cashSessions,
    financialEntries,
    staffMembers,
    settings,
    sequence: {
      product: ensureSequence(raw, "product", products.map((item) => item.id)),
      category: ensureSequence(raw, "category", categories.map((item) => item.id)),
      order: ensureSequence(raw, "order", orders.map((item) => item.id)),
      deliveryZone: ensureSequence(raw, "deliveryZone", deliveryZones.map((item) => item.id)),
      courier: ensureSequence(raw, "courier", couriers.map((item) => item.id)),
      customerAccount: ensureSequence(raw, "customerAccount", customerAccounts.map((item) => item.id)),
      feedback: ensureSequence(raw, "feedback", feedbacks.map((item) => item.id)),
      coupon: ensureSequence(raw, "coupon", coupons.map((item) => item.id)),
      cashSession: ensureSequence(raw, "cashSession", cashSessions.map((item) => item.id)),
      financialEntry: ensureSequence(raw, "financialEntry", financialEntries.map((item) => item.id)),
      staffMember: ensureSequence(raw, "staffMember", staffMembers.map((item) => item.id)),
    },
  }
}

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  try {
    await fs.access(DATA_FILE)
  } catch {
    let initial: StoreData
    try {
      const seedPath = path.join(process.cwd(), "data", "store.seed.json")
      const seedRaw = await fs.readFile(seedPath, "utf8")
      initial = normalizeStore(JSON.parse(seedRaw) as Partial<StoreData>)
    } catch {
      initial = normalizeStore({})
    }
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8")
  }
}

async function readStore(): Promise<StoreData> {
  await ensureDataFile()
  const raw = await fs.readFile(DATA_FILE, "utf8")
  return normalizeStore(JSON.parse(raw) as Partial<StoreData>)
}

async function writeStore(data: StoreData) {
  await ensureDataFile()
  const payload = JSON.stringify(data, null, 2)
  const tempFile = `${DATA_FILE}.${process.pid}.tmp`
  await fs.writeFile(tempFile, payload, "utf8")
  await fs.rename(tempFile, DATA_FILE)
}

async function mutateStore<T>(mutator: (data: StoreData) => T | Promise<T>): Promise<T> {
  let resolveResult!: (value: T) => void
  let rejectResult!: (reason?: unknown) => void
  const result = new Promise<T>((resolve, reject) => { resolveResult = resolve; rejectResult = reject })
  mutationQueue = mutationQueue.catch(() => undefined).then(async () => {
    try {
      const data = await readStore()
      const value = await mutator(data)
      await writeStore(data)
      resolveResult(value)
    } catch (error) {
      rejectResult(error)
    }
  })
  return result
}

export async function getProducts(options?: { includeInactive?: boolean }) {
  const data = await readStore()
  const products = options?.includeInactive ? data.products : data.products.filter((product) => product.active)
  return [...products].sort((a, b) => Number(b.featured) - Number(a.featured) || a.category.localeCompare(b.category, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"))
}

export async function createProduct(input: { name: string; description: string; category: string; price: number; image?: string; featured?: boolean; trackStock?: boolean; stock?: number; minStock?: number }) {
  return mutateStore((data) => {
    const now = new Date().toISOString()
    const id = data.sequence.product + 1
    const product: Product = {
      id,
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category.trim(),
      price: Number(Number(input.price).toFixed(2)),
      active: true,
      featured: Boolean(input.featured),
      image: input.image?.trim() || "",
      trackStock: Boolean(input.trackStock),
      stock: Math.max(0, Math.floor(Number(input.stock || 0))),
      minStock: Math.max(0, Math.floor(Number(input.minStock || 0))),
      createdAt: now,
      updatedAt: now,
    }
    if (!product.name || !product.category || !Number.isFinite(product.price) || product.price < 0) throw new Error("Dados do produto inválidos.")
    data.sequence.product = id
    data.products.push(product)
    if (!data.categories.some((category) => category.name.toLowerCase() === product.category.toLowerCase())) {
      const categoryId = data.sequence.category + 1
      data.sequence.category = categoryId
      data.categories.push({ id: categoryId, name: product.category, active: true, sortOrder: data.categories.length + 1, createdAt: now, updatedAt: now })
    }
    return product
  })
}

export async function updateProduct(id: number, patch: Partial<Pick<Product, "name" | "description" | "category" | "price" | "active" | "featured" | "image" | "trackStock" | "stock" | "minStock">>) {
  return mutateStore((data) => {
    const product = data.products.find((item) => item.id === id)
    if (!product) return null
    if (patch.name !== undefined) product.name = patch.name.trim()
    if (patch.description !== undefined) product.description = patch.description.trim()
    if (patch.category !== undefined) product.category = patch.category.trim()
    if (patch.price !== undefined) product.price = Math.max(0, Number(Number(patch.price).toFixed(2)))
    if (patch.active !== undefined) product.active = Boolean(patch.active)
    if (patch.featured !== undefined) product.featured = Boolean(patch.featured)
    if (patch.image !== undefined) product.image = patch.image.trim()
    if (patch.trackStock !== undefined) product.trackStock = Boolean(patch.trackStock)
    if (patch.stock !== undefined) product.stock = Math.max(0, Math.floor(Number(patch.stock)))
    if (patch.minStock !== undefined) product.minStock = Math.max(0, Math.floor(Number(patch.minStock)))
    product.updatedAt = new Date().toISOString()
    return product
  })
}

export async function deleteProduct(id: number) { return updateProduct(id, { active: false }) }

export async function getCategories(options?: { includeInactive?: boolean }) {
  const data = await readStore()
  const categories = options?.includeInactive ? data.categories : data.categories.filter((category) => category.active)
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
}

export async function createCategory(name: string) {
  return mutateStore((data) => {
    const value = name.trim()
    if (!value) throw new Error("Informe o nome da categoria.")
    if (data.categories.some((category) => category.name.toLowerCase() === value.toLowerCase())) throw new Error("Essa categoria já existe.")
    const now = new Date().toISOString()
    const id = data.sequence.category + 1
    const category: Category = { id, name: value, active: true, sortOrder: data.categories.length + 1, createdAt: now, updatedAt: now }
    data.sequence.category = id
    data.categories.push(category)
    return category
  })
}

export async function updateCategory(id: number, patch: Partial<Pick<Category, "name" | "active" | "sortOrder">>) {
  return mutateStore((data) => {
    const category = data.categories.find((item) => item.id === id)
    if (!category) return null
    const oldName = category.name
    if (patch.name !== undefined) category.name = patch.name.trim() || category.name
    if (patch.active !== undefined) category.active = patch.active
    if (patch.sortOrder !== undefined) category.sortOrder = Math.max(0, Number(patch.sortOrder))
    category.updatedAt = new Date().toISOString()
    if (category.name !== oldName) data.products.forEach((product) => { if (product.category === oldName) product.category = category.name })
    return category
  })
}

export async function getDeliveryZones(options?: { includeInactive?: boolean }) {
  const data = await readStore()
  const list = options?.includeInactive ? data.deliveryZones : data.deliveryZones.filter((zone) => zone.active)
  return [...list].sort((a, b) => a.fee - b.fee || a.id - b.id)
}

export async function createDeliveryZone(input: Pick<DeliveryZone, "name" | "centerLat" | "centerLng" | "radiusMeters" | "fee" | "shape" | "points">) {
  return mutateStore((data) => {
    const now = new Date().toISOString()
    const id = data.sequence.deliveryZone + 1
    const points = Array.isArray(input.points) ? input.points.map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)) : []
    const shape = input.shape === "polygon" && points.length >= 3 ? "polygon" : "circle"
    const zone: DeliveryZone = {
      id,
      name: input.name.trim(),
      color: nextDeliveryZoneColor(data.deliveryZones),
      shape,
      points,
      centerLat: Number(input.centerLat),
      centerLng: Number(input.centerLng),
      radiusMeters: Math.max(50, Math.round(Number(input.radiusMeters || 1500))),
      fee: Math.max(0, Number(Number(input.fee).toFixed(2))),
      active: true,
      createdAt: now,
      updatedAt: now,
    }
    if (!zone.name || !Number.isFinite(zone.fee)) throw new Error("Dados da área de entrega inválidos.")
    if (shape === "polygon" && points.length < 3) throw new Error("Desenhe pelo menos 3 pontos para criar a área personalizada.")
    assertDeliveryZoneValid(zone, data.deliveryZones)
    data.sequence.deliveryZone = id
    data.deliveryZones.push(zone)
    return zone
  })
}

export async function updateDeliveryZone(id: number, patch: Partial<Pick<DeliveryZone, "name" | "centerLat" | "centerLng" | "radiusMeters" | "fee" | "active" | "shape" | "points">>) {
  return mutateStore((data) => {
    const zone = data.deliveryZones.find((item) => item.id === id)
    if (!zone) return null
    if (patch.name !== undefined) zone.name = patch.name.trim() || zone.name
    if (patch.centerLat !== undefined) zone.centerLat = Number(patch.centerLat)
    if (patch.centerLng !== undefined) zone.centerLng = Number(patch.centerLng)
    if (patch.radiusMeters !== undefined) zone.radiusMeters = Math.max(50, Math.round(Number(patch.radiusMeters)))
    if (patch.fee !== undefined) zone.fee = Math.max(0, Number(Number(patch.fee).toFixed(2)))
    if (patch.points !== undefined && Array.isArray(patch.points)) zone.points = patch.points.map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    if (patch.shape !== undefined) zone.shape = patch.shape === "polygon" && zone.points.length >= 3 ? "polygon" : "circle"
    if (patch.active !== undefined) zone.active = patch.active
    if (zone.active) assertDeliveryZoneValid(zone, data.deliveryZones, zone.id)
    zone.updatedAt = new Date().toISOString()
    return zone
  })
}

export async function deleteDeliveryZone(id: number) { return mutateStore((data) => { const index = data.deliveryZones.findIndex((item) => item.id === id); if (index === -1) return false; data.deliveryZones.splice(index, 1); return true }) }

export async function getCouriers(options?: { includeInactive?: boolean }) {
  const data = await readStore()
  const list = options?.includeInactive ? data.couriers : data.couriers.filter((courier) => courier.active)
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}

export async function createCourier(input: Pick<Courier, "name" | "phone" | "vehicle">) {
  return mutateStore((data) => {
    const now = new Date().toISOString(); const id = data.sequence.courier + 1
    const courier: Courier = { id, name: input.name.trim(), phone: input.phone.trim(), vehicle: input.vehicle.trim(), active: true, createdAt: now, updatedAt: now }
    if (!courier.name || !courier.phone) throw new Error("Nome e telefone do entregador são obrigatórios.")
    data.sequence.courier = id; data.couriers.push(courier); return courier
  })
}

export async function updateCourier(id: number, patch: Partial<Pick<Courier, "name" | "phone" | "vehicle" | "active">>) {
  return mutateStore((data) => { const courier = data.couriers.find((item) => item.id === id); if (!courier) return null; if (patch.name !== undefined) courier.name = patch.name.trim(); if (patch.phone !== undefined) courier.phone = patch.phone.trim(); if (patch.vehicle !== undefined) courier.vehicle = patch.vehicle.trim(); if (patch.active !== undefined) courier.active = patch.active; courier.updatedAt = new Date().toISOString(); return courier })
}
export async function deleteCourier(id: number) { return updateCourier(id, { active: false }) }

export async function getOrders() { const data = await readStore(); return [...data.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }
export async function getOrderByReference(reference: string) { const data = await readStore(); return data.orders.find((order) => order.reference.toLowerCase() === reference.toLowerCase()) || null }
export async function getOrderById(id: number) { const data = await readStore(); return data.orders.find((order) => order.id === id) || null }

export async function updateOrder(id: number, patch: Partial<Pick<Order, "status" | "paymentStatus" | "courierId" | "courierName" | "printedAt">>) {
  return mutateStore((data) => { const index = data.orders.findIndex((order) => order.id === id); if (index === -1) return null; data.orders[index] = { ...data.orders[index], ...patch, updatedAt: new Date().toISOString() }; return data.orders[index] })
}

interface CreateOrderInput {
  type: Order["type"]
  paymentMethod: Order["paymentMethod"]
  changeFor?: string
  notes?: string
  customer: Order["customer"]
  items: Array<{ productId: number; quantity: number }>
  requestedFor?: string
  timing?: "now" | "scheduled"
  couponCode?: string
  channel?: Order["channel"]
  bypassLeadTime?: boolean
}

function couponDiscount(data: StoreData, code: string | undefined, subtotal: number) {
  if (!code?.trim()) return { discount: 0, coupon: undefined as Coupon | undefined }
  const coupon = data.coupons.find((item) => item.active && item.code.toLowerCase() === code.trim().toLowerCase())
  if (!coupon) throw new Error("Cupom inválido ou inativo.")
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) throw new Error("Este cupom expirou.")
  if (subtotal < coupon.minimumOrder) throw new Error(`Este cupom exige pedido mínimo de R$ ${coupon.minimumOrder.toFixed(2).replace(".", ",")}.`)
  const discount = coupon.type === "percent" ? subtotal * Math.min(100, coupon.value) / 100 : Math.min(subtotal, coupon.value)
  return { discount: Number(discount.toFixed(2)), coupon }
}

export async function createOrder(input: CreateOrderInput) {
  let preparedDeliveryQuote: Awaited<ReturnType<typeof calculateDeliveryQuote>> | null = null
  if (input.type === "delivery") {
    const latitude = Number(input.customer.latitude)
    const longitude = Number(input.customer.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Defina a localização da entrega para calcular a taxa.")
    const snapshot = await readStore()
    preparedDeliveryQuote = await calculateDeliveryQuote(snapshot.settings, snapshot.deliveryZones, latitude, longitude, 0)
  }

  const order = await mutateStore((data) => {
    const nowDate = new Date(); const now = nowDate.toISOString()
    if (input.channel !== "PDV" && !isStoreOpenNow(data.settings, nowDate)) throw new Error("Pedidos são aceitos somente durante o horário de funcionamento da loja.")
    if (input.type === "delivery" && !data.settings.deliveryEnabled) throw new Error("Delivery indisponível no momento.")
    if (input.type === "pickup" && !data.settings.pickupEnabled) throw new Error("Retirada indisponível no momento.")

    const timing = input.timing === "now" ? "now" : "scheduled"
    const immediateLeadMinutes = input.type === "delivery" ? IMMEDIATE_DELIVERY_MAX_MINUTES : data.settings.pickupLeadMinutes
    const requestedDate = timing === "now"
      ? new Date(nowDate.getTime() + immediateLeadMinutes * 60000)
      : new Date(String(input.requestedFor || ""))
    if (Number.isNaN(requestedDate.getTime())) throw new Error("Escolha uma data e um horário válidos para receber o pedido.")
    if (timing === "scheduled" && input.channel !== "PDV" && !isWithinBusinessHours(data.settings, requestedDate)) throw new Error("O horário escolhido está fora do expediente da loja.")
    const leadMinutes = input.type === "delivery" ? data.settings.deliveryMinMinutes : data.settings.pickupLeadMinutes
    if (timing === "scheduled" && !input.bypassLeadTime && requestedDate.getTime() < nowDate.getTime() + leadMinutes * 60000) throw new Error(`Escolha um horário com pelo menos ${leadMinutes} minutos de antecedência.`)
    if (timing === "scheduled" && input.channel !== "PDV" && requestedDate.getTime() > nowDate.getTime() + (MAX_SCHEDULING_DAYS + 1) * 86400000) throw new Error(`O agendamento pode ser feito com até ${MAX_SCHEDULING_DAYS} dias de antecedência.`)

    const items = input.items.map((requestedItem) => {
      const product = data.products.find((item) => item.id === requestedItem.productId && item.active)
      if (!product) throw new Error(`Produto ${requestedItem.productId} não encontrado ou inativo.`)
      const quantity = Math.floor(Number(requestedItem.quantity))
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 500) throw new Error("Quantidade de produto inválida.")
      if (product.trackStock && product.stock < quantity) throw new Error(`${product.name} não possui estoque suficiente.`)
      const subtotal = Number((product.price * quantity).toFixed(2))
      return { productId: product.id, name: product.name, quantity, unitPrice: product.price, subtotal }
    })
    if (!items.length) throw new Error("Adicione pelo menos um produto ao pedido.")
    const subtotal = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
    if (subtotal < data.settings.minimumOrder) throw new Error(`Pedido mínimo de R$ ${data.settings.minimumOrder.toFixed(2).replace(".", ",")}.`)

    const { discount, coupon } = couponDiscount(data, input.couponCode, subtotal)
    let deliveryFee = 0; let matchedZone: DeliveryZone | null = null
    if (input.type === "delivery") {
      if (!preparedDeliveryQuote) throw new Error("Não foi possível calcular a entrega.")
      matchedZone = preparedDeliveryQuote.zone
      deliveryFee = data.settings.freeDeliveryAbove > 0 && subtotal >= data.settings.freeDeliveryAbove ? 0 : preparedDeliveryQuote.fee
    }

    const total = Number((Math.max(0, subtotal - discount) + deliveryFee).toFixed(2))
    const id = data.sequence.order + 1
    const reference = `CS-${String(id).padStart(5, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const address = input.type === "pickup" ? `Retirada — ${data.settings.storeName}, ${data.settings.address}${data.settings.storeDistrict ? ` - ${data.settings.storeDistrict}` : ""}, ${data.settings.city} - ${data.settings.state}` : input.customer.address
    const scheduled = timing === "scheduled"
    const order: Order = {
      id, code: `#${id}`, reference, type: input.type, status: "accepted", channel: input.channel || "WEB",
      subtotal, discount, ...(coupon ? { couponCode: coupon.code } : {}), deliveryFee, total, paymentStatus: "unpaid", paymentMethod: input.paymentMethod,
      ...(input.changeFor ? { changeFor: input.changeFor.trim() } : {}), ...(input.notes ? { notes: input.notes.trim() } : {}),
      customer: { ...input.customer, name: input.customer.name.trim(), phone: input.customer.phone.trim(), address },
      ...(matchedZone ? { deliveryZoneId: matchedZone.id, deliveryZoneName: matchedZone.name } : {}),
      requestedFor: requestedDate.toISOString(), scheduled, items, createdAt: now, updatedAt: now,
    }

    items.forEach((item) => { const product = data.products.find((entry) => entry.id === item.productId); if (product?.trackStock) product.stock = Math.max(0, product.stock - item.quantity) })
    if (input.customer.accountId && data.settings.loyaltyEnabled) {
      const account = data.customerAccounts.find((item) => item.id === input.customer.accountId)
      if (account) { account.loyaltyPoints += Math.floor(total * data.settings.loyaltyPointsPerReal); account.updatedAt = now }
    }
    data.sequence.order = id; data.orders.push(order); return order
  })

  // Fase 4: enquanto os pedidos ainda ficam no store.json, o estoque do
  // catálogo PostgreSQL é sincronizado após cada venda da empresa atual.
  // Falha nessa sincronização nunca cancela um pedido já criado.
  try {
    const changedIds = new Set(order.items.map((item) => item.productId))
    const currentProducts = await getProducts({ includeInactive: true })
    await syncCurrentDeploymentProductStocks(
      currentProducts
        .filter((product) => changedIds.has(product.id))
        .map((product) => ({ id: product.id, stock: product.stock })),
    )
  } catch (error) {
    console.error(
      "[SaborFlow] Não foi possível sincronizar o estoque no PostgreSQL:",
      error instanceof Error ? error.message : error,
    )
  }

  try {
    await syncCurrentDeploymentOrderFromLegacy(order, "checkout")
  } catch (error) {
    // O pedido já existe no fluxo legado. Não devolvemos erro ao cliente
    // para evitar que uma nova tentativa gere pedido duplicado.
    console.error(
      "[SaborFlow] Pedido criado, mas a cópia PostgreSQL falhou:",
      error instanceof Error ? error.message : error,
    )
  }

  return order
}

export async function createPdvOrder(input: Omit<CreateOrderInput, "channel" | "bypassLeadTime">) {
  return createOrder({ ...input, channel: "PDV", bypassLeadTime: true })
}

export async function getSettings() { const data = await readStore(); return data.settings }
export async function updateSettings(patch: Partial<StoreSettings>) {
  return mutateStore((data) => {
    data.settings = {
      ...data.settings,
      ...patch,
      deliveryFee: 0,
      minimumOrder: patch.minimumOrder !== undefined ? Math.max(0, Number(patch.minimumOrder)) : data.settings.minimumOrder,
      estimatedMinutes: patch.estimatedMinutes !== undefined ? Math.max(1, Math.floor(Number(patch.estimatedMinutes))) : data.settings.estimatedMinutes,
      deliveryMinMinutes: patch.deliveryMinMinutes !== undefined ? Math.max(5, Math.floor(Number(patch.deliveryMinMinutes))) : data.settings.deliveryMinMinutes,
      deliveryMaxMinutes: patch.deliveryMaxMinutes !== undefined ? Math.max(5, Math.floor(Number(patch.deliveryMaxMinutes))) : data.settings.deliveryMaxMinutes,
      pickupLeadMinutes: patch.pickupLeadMinutes !== undefined ? Math.max(5, Math.floor(Number(patch.pickupLeadMinutes))) : data.settings.pickupLeadMinutes,
      slotIntervalMinutes: patch.slotIntervalMinutes !== undefined ? Math.max(5, Math.floor(Number(patch.slotIntervalMinutes))) : data.settings.slotIntervalMinutes,
      schedulingDaysAhead: patch.schedulingDaysAhead !== undefined ? Math.max(1, Math.min(60, Math.floor(Number(patch.schedulingDaysAhead)))) : data.settings.schedulingDaysAhead,
      storeLatitude: patch.storeLatitude !== undefined ? Number(patch.storeLatitude) : data.settings.storeLatitude,
      storeLongitude: patch.storeLongitude !== undefined ? Number(patch.storeLongitude) : data.settings.storeLongitude,
      businessHours: Array.isArray(patch.businessHours) ? patch.businessHours : data.settings.businessHours,
      deliveryPricingMode: ["free", "fixed", "distance", "customAreas", "distanceBands"].includes(String(patch.deliveryPricingMode)) ? patch.deliveryPricingMode! : data.settings.deliveryPricingMode,
      fixedDeliveryFee: patch.fixedDeliveryFee !== undefined ? Math.max(0, Number(patch.fixedDeliveryFee)) : data.settings.fixedDeliveryFee,
      distanceBaseFee: patch.distanceBaseFee !== undefined ? Math.max(0, Number(patch.distanceBaseFee)) : data.settings.distanceBaseFee,
      distanceFeePerKm: patch.distanceFeePerKm !== undefined ? Math.max(0, Number(patch.distanceFeePerKm)) : data.settings.distanceFeePerKm,
      maxDeliveryDistanceKm: patch.maxDeliveryDistanceKm !== undefined ? Math.max(0, Number(patch.maxDeliveryDistanceKm)) : data.settings.maxDeliveryDistanceKm,
      freeDeliveryAbove: patch.freeDeliveryAbove !== undefined ? Math.max(0, Number(patch.freeDeliveryAbove)) : data.settings.freeDeliveryAbove,
      deliveryDistanceBands: Array.isArray(patch.deliveryDistanceBands) ? patch.deliveryDistanceBands.map((band, index) => ({ id: String(band.id || `band-${Date.now()}-${index}`), minKm: Math.max(0, Number(band.minKm || 0)), maxKm: Math.max(0, Number(band.maxKm || 0)), fee: Math.max(0, Number(band.fee || 0)), active: band.active ?? true })) : data.settings.deliveryDistanceBands,
      rememberClientDays: patch.rememberClientDays !== undefined ? Math.max(1, Math.min(365, Math.floor(Number(patch.rememberClientDays)))) : data.settings.rememberClientDays,
      loyaltyPointsPerReal: patch.loyaltyPointsPerReal !== undefined ? Math.max(0, Number(patch.loyaltyPointsPerReal)) : data.settings.loyaltyPointsPerReal,
      loyaltyRewardPoints: patch.loyaltyRewardPoints !== undefined ? Math.max(1, Math.floor(Number(patch.loyaltyRewardPoints))) : data.settings.loyaltyRewardPoints,
      printCopies: patch.printCopies !== undefined ? Math.max(1, Math.min(5, Math.floor(Number(patch.printCopies)))) : data.settings.printCopies,
    }
    if (data.settings.deliveryMaxMinutes < data.settings.deliveryMinMinutes) data.settings.deliveryMaxMinutes = data.settings.deliveryMinMinutes
    return data.settings
  })
}

function normalizeCpf(cpf: string) { return cpf.replace(/\D/g, "") }
function isValidCpf(cpf: string) {
  const value = normalizeCpf(cpf)
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false
  const digit = (length: number) => { let sum = 0; for (let i = 0; i < length; i += 1) sum += Number(value[i]) * (length + 1 - i); const mod = (sum * 10) % 11; return mod === 10 ? 0 : mod }
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10])
}
function cpfHash(cpf: string) { return createHash("sha256").update(`cris-cpf:${normalizeCpf(cpf)}`).digest("hex") }
function makePinHash(pin: string) { const salt = randomBytes(16).toString("hex"); const digest = scryptSync(pin, salt, 32).toString("hex"); return `${salt}:${digest}` }
function validPin(pin: string, stored: string) { const [salt, digest] = stored.split(":"); if (!salt || !digest) return false; const actual = scryptSync(pin, salt, 32); const expected = Buffer.from(digest, "hex"); return actual.length === expected.length && timingSafeEqual(actual, expected) }

export async function createCustomerAccount(input: { cpf: string; pin: string; name: string; phone: string; email?: string }) {
  return mutateStore((data) => {
    const cpfDigits = normalizeCpf(input.cpf)
    if (!isValidCpf(cpfDigits)) throw new Error("Informe um CPF válido com 11 números.")
    if (!/^\d{4,6}$/.test(input.pin)) throw new Error("Crie um PIN de 4 a 6 números.")
    const hash = cpfHash(cpfDigits)
    if (data.customerAccounts.some((item) => item.cpfHash === hash)) throw new Error("Já existe uma conta com este CPF.")
    const now = new Date().toISOString(); const id = data.sequence.customerAccount + 1
    const account: CustomerAccount = { id, cpfHash: hash, cpfLast4: cpfDigits.slice(-4), pinHash: makePinHash(input.pin), name: input.name.trim(), phone: input.phone.trim(), email: input.email?.trim() || "", defaultAddress: "", defaultNumber: "", defaultDistrict: "", defaultCity: data.settings.city, defaultState: data.settings.state, defaultZipCode: "", defaultComplement: "", defaultLatitude: null, defaultLongitude: null, loyaltyPoints: 0, active: true, createdAt: now, updatedAt: now }
    if (!account.name || !account.phone) throw new Error("Nome e telefone são obrigatórios.")
    data.sequence.customerAccount = id; data.customerAccounts.push(account); return account
  })
}

export async function authenticateCustomer(cpf: string, pin: string) {
  const data = await readStore(); const account = data.customerAccounts.find((item) => item.active && item.cpfHash === cpfHash(cpf)); if (!account || !validPin(pin, account.pinHash)) return null; return account
}
export async function getCustomerAccount(id: number) { const data = await readStore(); return data.customerAccounts.find((item) => item.id === id && item.active) || null }
export async function updateCustomerAccount(id: number, patch: Partial<Pick<CustomerAccount, "name" | "phone" | "email" | "defaultAddress" | "defaultNumber" | "defaultDistrict" | "defaultCity" | "defaultState" | "defaultZipCode" | "defaultComplement" | "defaultLatitude" | "defaultLongitude">>) {
  return mutateStore((data) => { const account = data.customerAccounts.find((item) => item.id === id); if (!account) return null; Object.assign(account, patch, { updatedAt: new Date().toISOString() }); return account })
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  const data = await readStore(); const map = new Map<string, CustomerSummary>()
  for (const order of data.orders) {
    if (order.status === "cancelled") continue
    const key = order.customer.phone.replace(/\D/g, "") || order.customer.name.toLowerCase(); const current = map.get(key)
    if (!current) map.set(key, { key, name: order.customer.name, phone: order.customer.phone, orders: 1, totalSpent: order.total, lastOrderAt: order.createdAt, loyaltyPoints: 0, segment: "new", lifecycle: "active" })
    else { current.orders += 1; current.totalSpent = Number((current.totalSpent + order.total).toFixed(2)); if (new Date(order.createdAt).getTime() > new Date(current.lastOrderAt).getTime()) current.lastOrderAt = order.createdAt }
  }
  for (const account of data.customerAccounts) {
    const key = account.phone.replace(/\D/g, "") || `account-${account.id}`
    const current = map.get(key) || { key, name: account.name, phone: account.phone, orders: 0, totalSpent: 0, lastOrderAt: account.createdAt, loyaltyPoints: account.loyaltyPoints, segment: "new" as const, lifecycle: "never" as const }
    current.loyaltyPoints = account.loyaltyPoints; current.cpfLast4 = account.cpfLast4; map.set(key, current)
  }
  const now = Date.now()
  return [...map.values()].map((customer) => {
    const days = Math.floor((now - new Date(customer.lastOrderAt).getTime()) / 86400000)
    customer.segment = customer.orders >= 20 || customer.totalSpent >= 500 ? "elite" : customer.orders >= 8 ? "frequent" : customer.orders >= 2 ? "repeat" : "new"
    customer.lifecycle = customer.orders === 0 ? "never" : days <= 30 ? "active" : days <= 90 ? "sleeping" : "inactive"
    return customer
  }).sort((a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime())
}

export async function createFeedback(input: { orderReference: string; rating: number; comment?: string }) {
  return mutateStore((data) => {
    const order = data.orders.find((item) => item.reference.toLowerCase() === input.orderReference.toLowerCase())
    if (!order) throw new Error("Pedido não encontrado.")
    if (data.feedbacks.some((item) => item.orderId === order.id)) throw new Error("Este pedido já foi avaliado.")
    const rating = Math.max(1, Math.min(5, Math.floor(Number(input.rating)))) as 1 | 2 | 3 | 4 | 5
    const reactions = ["😞", "🙁", "😐", "🙂", "😍"]
    const id = data.sequence.feedback + 1
    const feedback: Feedback = { id, orderId: order.id, orderReference: order.reference, customerName: order.customer.name, rating, reaction: reactions[rating - 1], comment: input.comment?.trim() || "", createdAt: new Date().toISOString() }
    data.sequence.feedback = id; data.feedbacks.push(feedback); return feedback
  })
}
export async function getFeedbacks() { const data = await readStore(); return [...data.feedbacks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }

export async function getCoupons(options?: { includeInactive?: boolean }) { const data = await readStore(); const list = options?.includeInactive ? data.coupons : data.coupons.filter((item) => item.active); return [...list].sort((a, b) => a.code.localeCompare(b.code)) }
export async function createCoupon(input: Omit<Coupon, "id" | "createdAt" | "updatedAt">) {
  return mutateStore((data) => { const code = input.code.trim().toUpperCase(); if (!code) throw new Error("Informe o código do cupom."); if (data.coupons.some((item) => item.code === code)) throw new Error("Esse cupom já existe."); const now = new Date().toISOString(); const id = data.sequence.coupon + 1; const coupon: Coupon = { ...input, id, code, value: Math.max(0, Number(input.value)), minimumOrder: Math.max(0, Number(input.minimumOrder)), createdAt: now, updatedAt: now }; data.sequence.coupon = id; data.coupons.push(coupon); return coupon })
}
export async function updateCoupon(id: number, patch: Partial<Coupon>) { return mutateStore((data) => { const coupon = data.coupons.find((item) => item.id === id); if (!coupon) return null; Object.assign(coupon, patch, { id: coupon.id, updatedAt: new Date().toISOString() }); coupon.code = coupon.code.toUpperCase(); return coupon }) }
export async function validateCoupon(code: string, subtotal: number) { const data = await readStore(); return couponDiscount(data, code, subtotal) }

export async function getCashSessions() { const data = await readStore(); return [...data.cashSessions].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()) }
export async function openCashSession(openedBy: string, openingAmount: number) { return mutateStore((data) => { const open = data.cashSessions.find((item) => !item.closedAt); if (open) throw new Error("Já existe um caixa aberto."); const id = data.sequence.cashSession + 1; const session: CashSession = { id, openedAt: new Date().toISOString(), openedBy, openingAmount: Math.max(0, Number(openingAmount)) }; data.sequence.cashSession = id; data.cashSessions.push(session); return session }) }
export async function closeCashSession(id: number, closingAmount: number, notes?: string) { return mutateStore((data) => { const session = data.cashSessions.find((item) => item.id === id); if (!session) return null; session.closedAt = new Date().toISOString(); session.closingAmount = Math.max(0, Number(closingAmount)); session.notes = notes?.trim() || ""; return session }) }

export async function getFinancialEntries() { const data = await readStore(); return [...data.financialEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }
export async function createFinancialEntry(input: Omit<FinancialEntry, "id" | "createdAt">) { return mutateStore((data) => { const id = data.sequence.financialEntry + 1; const entry: FinancialEntry = { id, type: input.type, category: input.category.trim(), description: input.description.trim(), amount: Math.max(0, Number(input.amount)), createdAt: new Date().toISOString() }; data.sequence.financialEntry = id; data.financialEntries.push(entry); return entry }) }

export async function getStaffMembers() { const data = await readStore(); return [...data.staffMembers].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }
export async function createStaffMember(input: Pick<StaffMember, "name" | "email" | "phone" | "role" | "permissions">) {
  return mutateStore((data) => {
    const now = new Date().toISOString(); const id = data.sequence.staffMember + 1
    const member: StaffMember = { id, name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone.trim(), role: input.role, permissions: Array.isArray(input.permissions) ? input.permissions : [], active: true, createdAt: now, updatedAt: now }
    if (!member.name) throw new Error("Informe o nome do colaborador.")
    data.sequence.staffMember = id; data.staffMembers.push(member); return member
  })
}
export async function updateStaffMember(id: number, patch: Partial<Pick<StaffMember, "name" | "email" | "phone" | "role" | "active" | "permissions">>) {
  return mutateStore((data) => { const member = data.staffMembers.find((item) => item.id === id); if (!member) return null; if (patch.name !== undefined) member.name = patch.name.trim(); if (patch.email !== undefined) member.email = patch.email.trim().toLowerCase(); if (patch.phone !== undefined) member.phone = patch.phone.trim(); if (patch.role !== undefined) member.role = patch.role; if (patch.active !== undefined) member.active = Boolean(patch.active); if (patch.permissions !== undefined) member.permissions = Array.isArray(patch.permissions) ? patch.permissions : []; member.updatedAt = new Date().toISOString(); return member })
}

export async function getUnprintedOrders() { const data = await readStore(); const cutoff = Date.now() - 48 * 60 * 60 * 1000; return data.orders.filter((order) => !["completed", "cancelled"].includes(order.status) && !order.printedAt && new Date(order.createdAt).getTime() >= cutoff).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) }
export async function markOrderPrinted(id: number) { return updateOrder(id, { printedAt: new Date().toISOString() }) }

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const orders = await getOrders(); const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }); const valid = orders.filter((order) => order.status !== "cancelled"); const todayOrdersList = valid.filter((order) => new Date(order.createdAt).toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }) === today)
  return { totalOrders: orders.length, openOrders: orders.filter((order) => ["pending", "accepted", "preparing", "in-route"].includes(order.status)).length, readyOrders: orders.filter((order) => order.status === "ready").length, completedOrders: orders.filter((order) => order.status === "completed").length, revenue: Number(valid.reduce((sum, order) => sum + order.total, 0).toFixed(2)), unpaid: valid.filter((order) => order.paymentStatus === "unpaid").length, todayOrders: todayOrdersList.length, todayRevenue: Number(todayOrdersList.reduce((sum, order) => sum + order.total, 0).toFixed(2)) }
}

export async function getAdminData() {
  const [summary, orders, products, categories, settings, customers, deliveryZones, couriers, feedbacks, coupons, cashSessions, financialEntries, staffMembers] = await Promise.all([
    getDashboardSummary(), getOrders(), getProducts({ includeInactive: true }), getCategories({ includeInactive: true }), getSettings(), getCustomers(), getDeliveryZones({ includeInactive: true }), getCouriers({ includeInactive: true }), getFeedbacks(), getCoupons({ includeInactive: true }), getCashSessions(), getFinancialEntries(), getStaffMembers(),
  ])
  return { summary, orders, products, categories, settings, customers, deliveryZones, couriers, feedbacks, coupons, cashSessions, financialEntries, staffMembers }
}

export async function getPublicStore() {
  const [products, categories, settings, deliveryZones] = await Promise.all([getProducts(), getCategories(), getSettings(), getDeliveryZones()])
  return { products, categories, settings, deliveryZones, openNow: isStoreOpenNow(settings) }
}

export function safeCustomer(account: CustomerAccount) {
  const { cpfHash: _cpfHash, pinHash: _pinHash, ...safe } = account
  return safe
}


/**
 * Ponte temporária da Fase 4.
 *
 * O catálogo administrativo passa a ser multiempresa no PostgreSQL, mas
 * storefront e pedidos continuam no store.json até a migração dos pedidos.
 * Estas funções mantêm apenas a empresa atual compatível com o fluxo legado.
 */
export async function syncLegacyCategoryFromTenant(
  category: Category,
  previousName?: string,
) {
  return mutateStore((data) => {
    const index = data.categories.findIndex((item) => item.id === category.id)

    if (index >= 0) {
      data.categories[index] = { ...category }
    } else {
      data.categories.push({ ...category })
    }

    data.sequence.category = Math.max(data.sequence.category, category.id)

    if (
      previousName &&
      previousName.toLowerCase() !== category.name.toLowerCase()
    ) {
      const now = new Date().toISOString()

      data.products.forEach((product) => {
        if (product.category.toLowerCase() === previousName.toLowerCase()) {
          product.category = category.name
          product.updatedAt = now
        }
      })
    }

    return category
  })
}

export async function syncLegacyProductFromTenant(product: Product) {
  return mutateStore((data) => {
    const index = data.products.findIndex((item) => item.id === product.id)

    if (index >= 0) {
      data.products[index] = { ...product }
    } else {
      data.products.push({ ...product })
    }

    data.sequence.product = Math.max(data.sequence.product, product.id)
    return product
  })
}


/**
 * Ponte temporária da Fase 5.
 *
 * Status e demais alterações administrativas passam a ser salvos no
 * PostgreSQL por organization_id. Para a empresa atual do deployment,
 * mantemos o mesmo pedido refletido no store.json enquanto clientes,
 * caixa, feedback e outros módulos ainda dependem do legado.
 */
export async function syncLegacyOrderFromTenant(order: Order) {
  return mutateStore((data) => {
    const index = data.orders.findIndex((item) => item.id === order.id)

    if (index >= 0) {
      data.orders[index] = JSON.parse(JSON.stringify(order)) as Order
    } else {
      data.orders.push(JSON.parse(JSON.stringify(order)) as Order)
    }

    data.sequence.order = Math.max(data.sequence.order, order.id)
    return order
  })
}
