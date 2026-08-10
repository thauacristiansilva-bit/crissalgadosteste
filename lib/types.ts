export type PaymentMethod = "card" | "cash" | "pix"
export type OrderType = "pickup" | "delivery"
export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "in-route"
  | "completed"
  | "cancelled"
export type PaymentStatus = "paid" | "unpaid"

export interface BusinessHour {
  day: number
  label: string
  enabled: boolean
  open: string
  close: string
}

export interface Category {
  id: number
  name: string
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: number
  name: string
  description: string
  category: string
  price: number
  active: boolean
  featured: boolean
  image?: string
  trackStock: boolean
  stock: number
  createdAt: string
  updatedAt: string
}

export interface DeliveryZone {
  id: number
  name: string
  centerLat: number
  centerLng: number
  radiusMeters: number
  fee: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Courier {
  id: number
  name: string
  phone: string
  vehicle: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  productId: number
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface OrderCustomer {
  name: string
  phone: string
  address: string
  number?: string
  district?: string
  city?: string
  state?: string
  zipCode?: string
  complement?: string
  latitude?: number | null
  longitude?: number | null
}

export interface Order {
  id: number
  code: string
  reference: string
  type: OrderType
  status: OrderStatus
  channel: "WEB" | "PDV" | "APP"
  subtotal: number
  deliveryFee: number
  total: number
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  changeFor?: string
  notes?: string
  customer: OrderCustomer
  courierId?: number
  courierName?: string
  deliveryZoneId?: number
  deliveryZoneName?: string
  requestedFor: string
  scheduled: boolean
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

export interface StoreSettings {
  storeName: string
  slogan: string
  phone: string
  whatsapp: string
  address: string
  city: string
  state: string
  zipCode: string
  storeLatitude: number
  storeLongitude: number
  acceptingOrders: boolean
  pickupEnabled: boolean
  deliveryEnabled: boolean
  deliveryFee: number
  minimumOrder: number
  estimatedMinutes: number
  deliveryMinMinutes: number
  deliveryMaxMinutes: number
  pickupLeadMinutes: number
  slotIntervalMinutes: number
  schedulingDaysAhead: number
  pixKey: string
  openingHours: string
  businessHours: BusinessHour[]
  pickupInstructions: string
}

export interface StoreData {
  products: Product[]
  categories: Category[]
  orders: Order[]
  deliveryZones: DeliveryZone[]
  couriers: Courier[]
  settings: StoreSettings
  sequence: {
    product: number
    category: number
    order: number
    deliveryZone: number
    courier: number
  }
}

export interface DashboardSummary {
  totalOrders: number
  openOrders: number
  readyOrders: number
  completedOrders: number
  revenue: number
  unpaid: number
  todayOrders: number
  todayRevenue: number
}

export interface CustomerSummary {
  key: string
  name: string
  phone: string
  orders: number
  totalSpent: number
  lastOrderAt: string
}
