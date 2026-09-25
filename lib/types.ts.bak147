export type PaymentMethod = "card" | "cash" | "pix"
export type OrderType = "pickup" | "delivery"
export type OrderAcceptanceMode = "automatic" | "manual"
export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "in-route"
  | "completed"
  | "cancelled"
export type PaymentStatus = "paid" | "unpaid"
export type CustomerSegment = "new" | "repeat" | "frequent" | "elite"
export type CustomerLifecycle = "never" | "active" | "sleeping" | "inactive"
export type StaffRole = "admin" | "manager" | "cashier" | "kitchen" | "courier"
export type StaffEmploymentType = "employee" | "contractor" | "temporary" | "partner" | "other"
export type DeliveryPricingMode = "free" | "fixed" | "distance" | "customAreas" | "distanceBands"

export interface GeoPoint {
  lat: number
  lng: number
}

export interface DeliveryDistanceBand {
  id: string
  minKm: number
  maxKm: number
  fee: number
  active: boolean
}

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


export type IngredientUnit = "g" | "kg" | "ml" | "l" | "unit" | "portion"

export interface Ingredient {
  id: number
  name: string
  unit: IngredientUnit
  stockQuantity: number
  minStockQuantity: number
  unitCost: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface InventoryMovement {
  id: number
  ingredientId: number
  ingredientName: string
  kind: "sale" | "reversal" | "manual_in" | "manual_out" | "adjustment" | "waste"
  quantityDelta: number
  unitCostSnapshot: number
  orderId?: number
  note: string
  createdAt: string
}

export interface ProductRecipeItem {
  ingredientId: number
  ingredientName: string
  unit: IngredientUnit
  quantity: number
  unitCost: number
  estimatedCost: number
}

export interface ProductModifierOptionIngredient {
  ingredientId: number
  ingredientName: string
  unit: IngredientUnit
  quantity: number
  unitCost: number
  estimatedCost: number
}

export interface ProductModifierOption {
  id: number
  name: string
  description: string
  priceDelta: number
  includedEligible: boolean
  active: boolean
  sortOrder: number
  available: boolean
  estimatedFoodCost?: number
  ingredients?: ProductModifierOptionIngredient[]
}

export interface ProductModifierGroup {
  id: number
  name: string
  description: string
  required: boolean
  minSelect: number
  maxSelect: number
  includedQuantity: number
  active: boolean
  sortOrder: number
  options: ProductModifierOption[]
}

export interface OrderItemModifier {
  groupId: number
  groupName: string
  optionId: number
  optionName: string
  priceDelta: number
  included: boolean
}

export interface ProductComposition {
  productId: number
  modifierGroups: ProductModifierGroup[]
  recipe: ProductRecipeItem[]
  estimatedFoodCost: number
  ingredientStockAvailable: boolean
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
  minStock: number
  modifierGroups?: ProductModifierGroup[]
  estimatedFoodCost?: number
  ingredientStockAvailable?: boolean
  createdAt: string
  updatedAt: string
}

export interface DeliveryZone {
  id: number
  name: string
  color: string
  fee: number
  active: boolean
  shape: "polygon" | "circle"
  points: GeoPoint[]
  centerLat: number
  centerLng: number
  radiusMeters: number
  createdAt: string
  updatedAt: string
}

export interface Courier {
  id: number
  name: string
  phone: string
  vehicle: string
  active: boolean
  staffMemberId?: number
  linkedUserId?: string
  staffEmail?: string
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  productId: number
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
  modifiers?: OrderItemModifier[]
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
  accountId?: number
}

export interface Order {
  id: number
  code: string
  reference: string
  type: OrderType
  status: OrderStatus
  channel: "WEB" | "PDV" | "APP"
  subtotal: number
  discount: number
  couponCode?: string
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
  printedAt?: string
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

export interface CustomerAccount {
  id: number
  cpfHash: string
  cpfLast4: string
  pinHash: string
  name: string
  phone: string
  email: string
  defaultAddress: string
  defaultNumber: string
  defaultDistrict: string
  defaultCity: string
  defaultState: string
  defaultZipCode: string
  defaultComplement: string
  defaultLatitude: number | null
  defaultLongitude: number | null
  loyaltyPoints: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Feedback {
  id: number
  orderId: number
  orderReference: string
  customerName: string
  rating: 1 | 2 | 3 | 4 | 5
  reaction: string
  comment: string
  createdAt: string
}

export interface Coupon {
  id: number
  code: string
  description: string
  type: "percent" | "fixed"
  value: number
  minimumOrder: number
  active: boolean
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface CashSession {
  id: number
  openedAt: string
  openedBy: string
  openingAmount: number
  closedAt?: string
  closingAmount?: number
  notes?: string
}


export interface StaffMember {
  id: number
  name: string
  email: string
  phone: string
  role: StaffRole
  active: boolean
  permissions: string[]
  hireDate?: string
  employmentType?: StaffEmploymentType | null
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface FinancialEntry {
  id: number
  type: "income" | "expense"
  category: string
  description: string
  amount: number
  createdAt: string
}

export interface StoreSettings {
  /** IANA time zone of the organization. Legacy data may omit this field. */
  timeZone?: string
  storeName: string
  systemName: string
  slogan: string
  welcomeTitle: string
  welcomeText: string
  phone: string
  whatsapp: string
  whatsappUrl: string
  instagramUrl: string
  facebookUrl: string
  tiktokUrl: string
  youtubeUrl: string
  websiteUrl: string
  address: string
  storeDistrict: string
  city: string
  state: string
  zipCode: string
  storeLatitude: number
  storeLongitude: number
  acceptingOrders: boolean
  /** automatic = entra aceito; manual = aguarda aceite da equipe. */
  orderAcceptanceMode?: OrderAcceptanceMode
  pickupEnabled: boolean
  deliveryEnabled: boolean
  /** Compartilha GPS somente enquanto o pedido do cliente é a entrega ativa. */
  deliveryTrackingEnabled?: boolean
  dineInEnabled: boolean
  deliveryFee: number
  deliveryPricingMode: DeliveryPricingMode
  fixedDeliveryFee: number
  distanceBaseFee: number
  distanceFeePerKm: number
  maxDeliveryDistanceKm: number
  freeDeliveryAbove: number
  deliveryDistanceBands: DeliveryDistanceBand[]
  minimumOrder: number
  estimatedMinutes: number
  deliveryMinMinutes: number
  deliveryMaxMinutes: number
  pickupLeadMinutes: number
  slotIntervalMinutes: number
  schedulingDaysAhead: number
  checkoutTimingVersion: number
  pixKey: string
  openingHours: string
  businessHours: BusinessHour[]
  pickupInstructions: string
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  logoImage: string
  coverImage: string
  /** Conteúdo opcional da landing page pública da empresa. */
  aboutTitle?: string
  aboutText?: string
  galleryTitle?: string
  galleryImages?: string[]
  googleReviewUrl: string
  googleBusinessUrl: string
  checkoutAfterSubmit: "ask" | "whatsapp" | "site"
  clientAccountsEnabled: boolean
  rememberClientDays: number
  loyaltyEnabled: boolean
  loyaltyPointsPerReal: number
  loyaltyRewardText: string
  loyaltyRewardPoints: number
  autoPrintNewOrders: boolean
  printerName: string
  printCopies: number
  printKitchenTicket: boolean
  printCustomerTicket: boolean
  whatsappBulkEnabled: boolean
  chatbotEnabled: boolean
  chatbotGreeting: string
  cashRegisterEnabled: boolean
  fiscalEnabled: boolean
  fiscalProviderUrl: string
  totemEnabled: boolean
  googleAnalyticsId: string
  metaPixelId: string
  cardEnabled: boolean
  cashEnabled: boolean
  pixEnabled: boolean
}

export interface StoreData {
  products: Product[]
  categories: Category[]
  orders: Order[]
  deliveryZones: DeliveryZone[]
  couriers: Courier[]
  customerAccounts: CustomerAccount[]
  feedbacks: Feedback[]
  coupons: Coupon[]
  cashSessions: CashSession[]
  financialEntries: FinancialEntry[]
  staffMembers: StaffMember[]
  settings: StoreSettings
  sequence: {
    product: number
    category: number
    order: number
    deliveryZone: number
    courier: number
    customerAccount: number
    feedback: number
    coupon: number
    cashSession: number
    financialEntry: number
    staffMember: number
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
  loyaltyPoints: number
  segment: CustomerSegment
  lifecycle: CustomerLifecycle
  cpfLast4?: string
}
