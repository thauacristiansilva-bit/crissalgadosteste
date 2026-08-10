import { promises as fs } from "node:fs"
import path from "node:path"
import { defaultBusinessHours, findDeliveryZone, isStoreOpenNow, isWithinBusinessHours } from "@/lib/operations"
import type {
  Category,
  Courier,
  CustomerSummary,
  DashboardSummary,
  DeliveryZone,
  Order,
  Product,
  StoreData,
  StoreSettings,
} from "@/lib/types"

const DATA_FILE = path.join(process.cwd(), "data", "store.json")
let mutationQueue: Promise<void> = Promise.resolve()

const defaultSettings: StoreSettings = {
  storeName: "Cris Salgados",
  slogan: "Sabor e qualidade em cada pedido",
  phone: "(99) 98456-7999",
  whatsapp: "5599984567999",
  address: "R. Galeão, 30",
  city: "Bacabal",
  state: "MA",
  zipCode: "65700-000",
  storeLatitude: -4.225,
  storeLongitude: -44.786,
  acceptingOrders: true,
  pickupEnabled: true,
  deliveryEnabled: true,
  deliveryFee: 0,
  minimumOrder: 0,
  estimatedMinutes: 45,
  deliveryMinMinutes: 30,
  deliveryMaxMinutes: 50,
  pickupLeadMinutes: 30,
  slotIntervalMinutes: 15,
  schedulingDaysAhead: 14,
  pixKey: "",
  openingHours: "Seg a Sáb · 08:00 às 20:00",
  businessHours: defaultBusinessHours,
  pickupInstructions: "Retire seu pedido no balcão informando o nome e o número do pedido.",
}

function normalizeStore(raw: Partial<StoreData>): StoreData {
  const settings: StoreSettings = {
    ...defaultSettings,
    ...(raw.settings || {}),
    businessHours: Array.isArray(raw.settings?.businessHours) && raw.settings.businessHours.length
      ? raw.settings.businessHours
      : defaultBusinessHours,
  }

  const products = Array.isArray(raw.products)
    ? raw.products.map((product) => ({
        ...product,
        featured: product.featured ?? false,
        image: product.image ?? "",
        trackStock: product.trackStock ?? false,
        stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0,
      }))
    : []

  const now = new Date().toISOString()
  const categoryNames = Array.from(new Set(products.map((product) => product.category).filter(Boolean)))
  const categories: Category[] = Array.isArray(raw.categories) && raw.categories.length
    ? raw.categories
    : categoryNames.map((name, index) => ({
        id: index + 1,
        name,
        active: true,
        sortOrder: index + 1,
        createdAt: now,
        updatedAt: now,
      }))

  const deliveryZones: DeliveryZone[] = Array.isArray(raw.deliveryZones)
    ? raw.deliveryZones.map((zone) => ({
        ...zone,
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

  const orders = Array.isArray(raw.orders)
    ? raw.orders.map((order) => {
        const created = new Date(order.createdAt)
        const fallbackMinutes = order.type === "delivery" ? settings.deliveryMaxMinutes : settings.pickupLeadMinutes
        const fallbackRequested = new Date(created.getTime() + fallbackMinutes * 60000).toISOString()
        return {
          ...order,
          status: order.status || "pending",
          subtotal: Number.isFinite(Number(order.subtotal)) ? Number(order.subtotal) : Number(order.total || 0),
          deliveryFee: Number.isFinite(Number(order.deliveryFee)) ? Number(order.deliveryFee) : 0,
          requestedFor: order.requestedFor || fallbackRequested,
          scheduled: order.scheduled ?? false,
        }
      })
    : []

  return {
    products,
    categories,
    orders,
    deliveryZones,
    couriers,
    settings,
    sequence: {
      product: Math.max(Number(raw.sequence?.product || 0), ...products.map((item) => item.id), 0),
      category: Math.max(Number(raw.sequence?.category || 0), ...categories.map((item) => item.id), 0),
      order: Math.max(Number(raw.sequence?.order || 0), ...orders.map((item) => item.id), 0),
      deliveryZone: Math.max(Number(raw.sequence?.deliveryZone || 0), ...deliveryZones.map((item) => item.id), 0),
      courier: Math.max(Number(raw.sequence?.courier || 0), ...couriers.map((item) => item.id), 0),
    },
  }
}

async function readStore(): Promise<StoreData> {
  const raw = await fs.readFile(DATA_FILE, "utf8")
  return normalizeStore(JSON.parse(raw) as Partial<StoreData>)
}

async function writeStore(data: StoreData) {
  const payload = JSON.stringify(data, null, 2)
  const tempFile = `${DATA_FILE}.${process.pid}.tmp`
  await fs.writeFile(tempFile, payload, "utf8")
  await fs.rename(tempFile, DATA_FILE)
}

async function mutateStore<T>(mutator: (data: StoreData) => T | Promise<T>): Promise<T> {
  let resolveResult!: (value: T) => void
  let rejectResult!: (reason?: unknown) => void
  const result = new Promise<T>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })

  mutationQueue = mutationQueue
    .catch(() => undefined)
    .then(async () => {
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
  return [...products].sort((a, b) => a.category.localeCompare(b.category, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"))
}

export async function createProduct(input: {
  name: string
  description: string
  category: string
  price: number
  image?: string
  featured?: boolean
  trackStock?: boolean
  stock?: number
}) {
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
      createdAt: now,
      updatedAt: now,
    }

    data.sequence.product = id
    data.products.push(product)
    if (!data.categories.some((category) => category.name.toLowerCase() === product.category.toLowerCase())) {
      const categoryId = data.sequence.category + 1
      data.sequence.category = categoryId
      data.categories.push({
        id: categoryId,
        name: product.category,
        active: true,
        sortOrder: data.categories.length + 1,
        createdAt: now,
        updatedAt: now,
      })
    }
    return product
  })
}

export async function updateProduct(
  id: number,
  patch: Partial<Pick<Product, "name" | "description" | "category" | "price" | "active" | "image" | "featured" | "trackStock" | "stock">>,
) {
  return mutateStore((data) => {
    const index = data.products.findIndex((product) => product.id === id)
    if (index === -1) return null

    data.products[index] = {
      ...data.products[index],
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
      ...(patch.category !== undefined ? { category: patch.category.trim() } : {}),
      ...(patch.price !== undefined ? { price: Number(Number(patch.price).toFixed(2)) } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.image !== undefined ? { image: patch.image.trim() } : {}),
      ...(patch.featured !== undefined ? { featured: patch.featured } : {}),
      ...(patch.trackStock !== undefined ? { trackStock: patch.trackStock } : {}),
      ...(patch.stock !== undefined ? { stock: Math.max(0, Math.floor(Number(patch.stock))) } : {}),
      updatedAt: new Date().toISOString(),
    }

    return data.products[index]
  })
}

export async function deleteProduct(id: number) {
  return mutateStore((data) => {
    const product = data.products.find((item) => item.id === id)
    if (!product) return false
    product.active = false
    product.updatedAt = new Date().toISOString()
    return true
  })
}

export async function getCategories(options?: { includeInactive?: boolean }) {
  const data = await readStore()
  const list = options?.includeInactive ? data.categories : data.categories.filter((category) => category.active)
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
}

export async function createCategory(name: string) {
  return mutateStore((data) => {
    const clean = name.trim()
    if (!clean) throw new Error("Informe o nome da categoria.")
    if (data.categories.some((category) => category.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error("Essa categoria já existe.")
    }
    const now = new Date().toISOString()
    const id = data.sequence.category + 1
    const category: Category = {
      id,
      name: clean,
      active: true,
      sortOrder: data.categories.length + 1,
      createdAt: now,
      updatedAt: now,
    }
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
    if (patch.name !== undefined) {
      const clean = patch.name.trim()
      if (!clean) throw new Error("Informe o nome da categoria.")
      category.name = clean
      data.products.forEach((product) => {
        if (product.category === oldName) product.category = clean
      })
    }
    if (patch.active !== undefined) category.active = patch.active
    if (patch.sortOrder !== undefined) category.sortOrder = Math.max(0, Math.floor(Number(patch.sortOrder)))
    category.updatedAt = new Date().toISOString()
    return category
  })
}

export async function getDeliveryZones(options?: { includeInactive?: boolean }) {
  const data = await readStore()
  const list = options?.includeInactive ? data.deliveryZones : data.deliveryZones.filter((zone) => zone.active)
  return [...list].sort((a, b) => a.radiusMeters - b.radiusMeters || a.fee - b.fee)
}

export async function createDeliveryZone(input: Pick<DeliveryZone, "name" | "centerLat" | "centerLng" | "radiusMeters" | "fee">) {
  return mutateStore((data) => {
    const now = new Date().toISOString()
    const id = data.sequence.deliveryZone + 1
    const zone: DeliveryZone = {
      id,
      name: input.name.trim() || `Área ${id}`,
      centerLat: Number(input.centerLat),
      centerLng: Number(input.centerLng),
      radiusMeters: Math.max(50, Math.round(Number(input.radiusMeters))),
      fee: Math.max(0, Number(Number(input.fee).toFixed(2))),
      active: true,
      createdAt: now,
      updatedAt: now,
    }
    if (![zone.centerLat, zone.centerLng, zone.radiusMeters, zone.fee].every(Number.isFinite)) throw new Error("Dados da área de entrega inválidos.")
    data.sequence.deliveryZone = id
    data.deliveryZones.push(zone)
    return zone
  })
}

export async function updateDeliveryZone(id: number, patch: Partial<Pick<DeliveryZone, "name" | "centerLat" | "centerLng" | "radiusMeters" | "fee" | "active">>) {
  return mutateStore((data) => {
    const zone = data.deliveryZones.find((item) => item.id === id)
    if (!zone) return null
    if (patch.name !== undefined) zone.name = patch.name.trim() || zone.name
    if (patch.centerLat !== undefined) zone.centerLat = Number(patch.centerLat)
    if (patch.centerLng !== undefined) zone.centerLng = Number(patch.centerLng)
    if (patch.radiusMeters !== undefined) zone.radiusMeters = Math.max(50, Math.round(Number(patch.radiusMeters)))
    if (patch.fee !== undefined) zone.fee = Math.max(0, Number(Number(patch.fee).toFixed(2)))
    if (patch.active !== undefined) zone.active = patch.active
    zone.updatedAt = new Date().toISOString()
    return zone
  })
}

export async function deleteDeliveryZone(id: number) {
  return mutateStore((data) => {
    const index = data.deliveryZones.findIndex((item) => item.id === id)
    if (index === -1) return false
    data.deliveryZones.splice(index, 1)
    return true
  })
}

export async function getCouriers(options?: { includeInactive?: boolean }) {
  const data = await readStore()
  const list = options?.includeInactive ? data.couriers : data.couriers.filter((courier) => courier.active)
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}

export async function createCourier(input: Pick<Courier, "name" | "phone" | "vehicle">) {
  return mutateStore((data) => {
    const now = new Date().toISOString()
    const id = data.sequence.courier + 1
    const courier: Courier = {
      id,
      name: input.name.trim(),
      phone: input.phone.trim(),
      vehicle: input.vehicle.trim(),
      active: true,
      createdAt: now,
      updatedAt: now,
    }
    if (!courier.name || !courier.phone) throw new Error("Nome e telefone do entregador são obrigatórios.")
    data.sequence.courier = id
    data.couriers.push(courier)
    return courier
  })
}

export async function updateCourier(id: number, patch: Partial<Pick<Courier, "name" | "phone" | "vehicle" | "active">>) {
  return mutateStore((data) => {
    const courier = data.couriers.find((item) => item.id === id)
    if (!courier) return null
    if (patch.name !== undefined) courier.name = patch.name.trim()
    if (patch.phone !== undefined) courier.phone = patch.phone.trim()
    if (patch.vehicle !== undefined) courier.vehicle = patch.vehicle.trim()
    if (patch.active !== undefined) courier.active = patch.active
    courier.updatedAt = new Date().toISOString()
    return courier
  })
}

export async function deleteCourier(id: number) {
  return mutateStore((data) => {
    const courier = data.couriers.find((item) => item.id === id)
    if (!courier) return false
    courier.active = false
    courier.updatedAt = new Date().toISOString()
    return true
  })
}

export async function getOrders() {
  const data = await readStore()
  return [...data.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function getOrderByReference(reference: string) {
  const data = await readStore()
  return data.orders.find((order) => order.reference.toLowerCase() === reference.toLowerCase()) || null
}

export async function updateOrder(
  id: number,
  patch: Partial<Pick<Order, "status" | "paymentStatus" | "courierId" | "courierName">>,
) {
  return mutateStore((data) => {
    const index = data.orders.findIndex((order) => order.id === id)
    if (index === -1) return null
    data.orders[index] = { ...data.orders[index], ...patch, updatedAt: new Date().toISOString() }
    return data.orders[index]
  })
}

interface CreateOrderInput {
  type: Order["type"]
  paymentMethod: Order["paymentMethod"]
  changeFor?: string
  notes?: string
  customer: Order["customer"]
  items: Array<{ productId: number; quantity: number }>
  requestedFor: string
}

export async function createOrder(input: CreateOrderInput) {
  return mutateStore((data) => {
    const nowDate = new Date()
    const now = nowDate.toISOString()
    if (!isStoreOpenNow(data.settings, nowDate)) {
      throw new Error("Pedidos são aceitos somente durante o horário de funcionamento da loja.")
    }
    if (input.type === "delivery" && !data.settings.deliveryEnabled) throw new Error("Delivery indisponível no momento.")
    if (input.type === "pickup" && !data.settings.pickupEnabled) throw new Error("Retirada indisponível no momento.")

    const requestedDate = new Date(input.requestedFor)
    if (Number.isNaN(requestedDate.getTime())) throw new Error("Escolha uma data e um horário válidos para receber o pedido.")
    if (!isWithinBusinessHours(data.settings, requestedDate)) throw new Error("O horário escolhido está fora do expediente da loja.")

    const leadMinutes = input.type === "delivery" ? data.settings.deliveryMinMinutes : data.settings.pickupLeadMinutes
    if (requestedDate.getTime() < nowDate.getTime() + leadMinutes * 60000) {
      throw new Error(`Escolha um horário com pelo menos ${leadMinutes} minutos de antecedência.`)
    }
    if (requestedDate.getTime() > nowDate.getTime() + (data.settings.schedulingDaysAhead + 1) * 86400000) {
      throw new Error(`O agendamento pode ser feito com até ${data.settings.schedulingDaysAhead} dias de antecedência.`)
    }

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
    if (subtotal < data.settings.minimumOrder) {
      throw new Error(`Pedido mínimo de R$ ${data.settings.minimumOrder.toFixed(2).replace(".", ",")}.`)
    }

    let deliveryFee = 0
    let matchedZone: DeliveryZone | null = null
    if (input.type === "delivery") {
      const latitude = Number(input.customer.latitude)
      const longitude = Number(input.customer.longitude)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Defina a localização da entrega para calcular a taxa.")
      }
      const result = findDeliveryZone(data.deliveryZones, latitude, longitude)
      if (!result) throw new Error("O endereço informado está fora das áreas de entrega cadastradas.")
      matchedZone = result.zone
      deliveryFee = matchedZone.fee
    }

    const total = Number((subtotal + deliveryFee).toFixed(2))
    const id = data.sequence.order + 1
    const reference = `CS-${String(id).padStart(5, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const address = input.type === "pickup"
      ? `Retirada — ${data.settings.storeName}, ${data.settings.address}, ${data.settings.city} - ${data.settings.state}`
      : input.customer.address
    const scheduleThreshold = input.type === "delivery" ? data.settings.deliveryMaxMinutes : data.settings.pickupLeadMinutes
    const scheduled = requestedDate.getTime() > nowDate.getTime() + scheduleThreshold * 60000

    const order: Order = {
      id,
      code: `#${id}`,
      reference,
      type: input.type,
      status: "accepted",
      channel: "WEB",
      subtotal,
      deliveryFee,
      total,
      paymentStatus: "unpaid",
      paymentMethod: input.paymentMethod,
      ...(input.changeFor ? { changeFor: input.changeFor.trim() } : {}),
      ...(input.notes ? { notes: input.notes.trim() } : {}),
      customer: { ...input.customer, name: input.customer.name.trim(), phone: input.customer.phone.trim(), address },
      ...(matchedZone ? { deliveryZoneId: matchedZone.id, deliveryZoneName: matchedZone.name } : {}),
      requestedFor: requestedDate.toISOString(),
      scheduled,
      items,
      createdAt: now,
      updatedAt: now,
    }

    items.forEach((item) => {
      const product = data.products.find((entry) => entry.id === item.productId)
      if (product?.trackStock) product.stock = Math.max(0, product.stock - item.quantity)
    })

    data.sequence.order = id
    data.orders.push(order)
    return order
  })
}

export async function getSettings() {
  const data = await readStore()
  return data.settings
}

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
    }
    if (data.settings.deliveryMaxMinutes < data.settings.deliveryMinMinutes) {
      data.settings.deliveryMaxMinutes = data.settings.deliveryMinMinutes
    }
    return data.settings
  })
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  const orders = await getOrders()
  const map = new Map<string, CustomerSummary>()
  for (const order of orders) {
    if (order.status === "cancelled") continue
    const key = order.customer.phone.replace(/\D/g, "") || order.customer.name.toLowerCase()
    const current = map.get(key)
    if (!current) {
      map.set(key, {
        key,
        name: order.customer.name,
        phone: order.customer.phone,
        orders: 1,
        totalSpent: order.total,
        lastOrderAt: order.createdAt,
      })
    } else {
      current.orders += 1
      current.totalSpent = Number((current.totalSpent + order.total).toFixed(2))
      if (new Date(order.createdAt).getTime() > new Date(current.lastOrderAt).getTime()) current.lastOrderAt = order.createdAt
    }
  }
  return [...map.values()].sort((a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime())
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const orders = await getOrders()
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" })
  const valid = orders.filter((order) => order.status !== "cancelled")
  const todayOrdersList = valid.filter((order) => new Date(order.createdAt).toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }) === today)
  return {
    totalOrders: orders.length,
    openOrders: orders.filter((order) => ["pending", "accepted", "preparing", "in-route"].includes(order.status)).length,
    readyOrders: orders.filter((order) => order.status === "ready").length,
    completedOrders: orders.filter((order) => order.status === "completed").length,
    revenue: Number(valid.reduce((sum, order) => sum + order.total, 0).toFixed(2)),
    unpaid: valid.filter((order) => order.paymentStatus === "unpaid").length,
    todayOrders: todayOrdersList.length,
    todayRevenue: Number(todayOrdersList.reduce((sum, order) => sum + order.total, 0).toFixed(2)),
  }
}

export async function getPublicStore() {
  const [products, categories, settings, deliveryZones] = await Promise.all([
    getProducts(),
    getCategories(),
    getSettings(),
    getDeliveryZones(),
  ])
  return { products, categories, settings, deliveryZones, openNow: isStoreOpenNow(settings) }
}
