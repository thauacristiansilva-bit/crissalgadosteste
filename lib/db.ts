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
  Order,
  Product,
  StaffMember,
  StoreSettings,
} from "@/lib/types"

/**
 * Fase 25 — desligamento definitivo do store.json.
 *
 * Este módulo permanece apenas como fachada de compatibilidade para arquivos
 * antigos que ainda importam @/lib/db. Ele não lê, grava ou espelha arquivos.
 * Qualquer tentativa de usar uma operação legada falha explicitamente.
 */
export const LEGACY_STORE_RUNTIME_ENABLED = false as const

export class LegacyStoreDisabledError extends Error {
  constructor(operation = "operação") {
    super(
      `Legado store.json desligado na Fase 25. A ${operation} deve usar PostgreSQL tenant-aware.`,
    )
    this.name = "LegacyStoreDisabledError"
  }
}

export function legacyStoreRuntimeEnabled() {
  return LEGACY_STORE_RUNTIME_ENABLED
}

function disabled<T>(operation: string): Promise<T> {
  return Promise.reject(new LegacyStoreDisabledError(operation))
}

export function getProducts(..._args: any[]): Promise<Product[]> { return disabled("consulta de produtos") }
export function createProduct(..._args: any[]): Promise<Product> { return disabled("criação de produto") }
export function updateProduct(..._args: any[]): Promise<Product | null> { return disabled("atualização de produto") }
export function deleteProduct(..._args: any[]): Promise<Product | null> { return disabled("exclusão de produto") }
export function getCategories(..._args: any[]): Promise<Category[]> { return disabled("consulta de categorias") }
export function createCategory(..._args: any[]): Promise<Category> { return disabled("criação de categoria") }
export function updateCategory(..._args: any[]): Promise<Category | null> { return disabled("atualização de categoria") }
export function getDeliveryZones(..._args: any[]): Promise<DeliveryZone[]> { return disabled("consulta de áreas de entrega") }
export function createDeliveryZone(..._args: any[]): Promise<DeliveryZone> { return disabled("criação de área de entrega") }
export function updateDeliveryZone(..._args: any[]): Promise<DeliveryZone | null> { return disabled("atualização de área de entrega") }
export function deleteDeliveryZone(..._args: any[]): Promise<boolean> { return disabled("exclusão de área de entrega") }
export function getCouriers(..._args: any[]): Promise<Courier[]> { return disabled("consulta de entregadores") }
export function createCourier(..._args: any[]): Promise<Courier> { return disabled("criação de entregador") }
export function updateCourier(..._args: any[]): Promise<Courier | null> { return disabled("atualização de entregador") }
export function deleteCourier(..._args: any[]): Promise<Courier | null> { return disabled("exclusão de entregador") }
export function getOrders(..._args: any[]): Promise<Order[]> { return disabled("consulta de pedidos") }
export function getOrderByReference(..._args: any[]): Promise<Order | null> { return disabled("consulta de pedido") }
export function getOrderById(..._args: any[]): Promise<Order | null> { return disabled("consulta de pedido") }
export function updateOrder(..._args: any[]): Promise<Order | null> { return disabled("atualização de pedido") }
export function createOrder(..._args: any[]): Promise<Order> { return disabled("criação de pedido") }
export function createPdvOrder(..._args: any[]): Promise<Order> { return disabled("criação de pedido PDV") }
export function getSettings(..._args: any[]): Promise<StoreSettings> { return disabled("consulta de configurações") }
export function updateSettings(..._args: any[]): Promise<StoreSettings> { return disabled("atualização de configurações") }
export function createCustomerAccount(..._args: any[]): Promise<CustomerAccount> { return disabled("criação de cliente") }
export function authenticateCustomer(..._args: any[]): Promise<CustomerAccount | null> { return disabled("autenticação de cliente") }
export function getCustomerAccount(..._args: any[]): Promise<CustomerAccount | null> { return disabled("consulta de cliente") }
export function getCustomerAccounts(..._args: any[]): Promise<CustomerAccount[]> { return disabled("consulta de clientes") }
export function updateCustomerAccount(..._args: any[]): Promise<CustomerAccount | null> { return disabled("atualização de cliente") }
export function getCustomers(..._args: any[]): Promise<CustomerSummary[]> { return disabled("consulta CRM") }
export function createFeedback(..._args: any[]): Promise<Feedback> { return disabled("criação de avaliação") }
export function getFeedbacks(..._args: any[]): Promise<Feedback[]> { return disabled("consulta de avaliações") }
export function getCoupons(..._args: any[]): Promise<Coupon[]> { return disabled("consulta de cupons") }
export function createCoupon(..._args: any[]): Promise<Coupon> { return disabled("criação de cupom") }
export function updateCoupon(..._args: any[]): Promise<Coupon | null> { return disabled("atualização de cupom") }
export function validateCoupon(..._args: any[]): Promise<any> { return disabled("validação de cupom") }
export function getCashSessions(..._args: any[]): Promise<CashSession[]> { return disabled("consulta de caixa") }
export function openCashSession(..._args: any[]): Promise<CashSession> { return disabled("abertura de caixa") }
export function closeCashSession(..._args: any[]): Promise<CashSession | null> { return disabled("fechamento de caixa") }
export function getFinancialEntries(..._args: any[]): Promise<FinancialEntry[]> { return disabled("consulta financeira") }
export function createFinancialEntry(..._args: any[]): Promise<FinancialEntry> { return disabled("lançamento financeiro") }
export function getStaffMembers(..._args: any[]): Promise<StaffMember[]> { return disabled("consulta de equipe") }
export function createStaffMember(..._args: any[]): Promise<StaffMember> { return disabled("criação de funcionário") }
export function updateStaffMember(..._args: any[]): Promise<StaffMember | null> { return disabled("atualização de funcionário") }
export function getUnprintedOrders(..._args: any[]): Promise<Order[]> { return disabled("fila de impressão") }
export function markOrderPrinted(..._args: any[]): Promise<Order | null> { return disabled("marcação de impressão") }
export function getDashboardSummary(..._args: any[]): Promise<DashboardSummary> { return disabled("resumo administrativo") }

export function getAdminData(): Promise<{
  summary: DashboardSummary
  orders: Order[]
  products: Product[]
  categories: Category[]
  settings: StoreSettings
  customers: CustomerSummary[]
  deliveryZones: DeliveryZone[]
  couriers: Courier[]
  feedbacks: Feedback[]
  coupons: Coupon[]
  cashSessions: CashSession[]
  financialEntries: FinancialEntry[]
  staffMembers: StaffMember[]
}> {
  return disabled("painel administrativo legado")
}

export function getPublicStore(): Promise<{
  products: Product[]
  categories: Category[]
  settings: StoreSettings
  deliveryZones: DeliveryZone[]
  openNow: boolean
}> {
  return disabled("storefront legado")
}

export function safeCustomer(account: CustomerAccount) {
  const { cpfHash: _cpfHash, pinHash: _pinHash, ...safe } = account
  return safe
}

async function inertMirror<T>(value: T, ..._args: unknown[]): Promise<T> {
  return value
}

export const syncLegacyCategoryFromTenant = inertMirror
export const syncLegacyProductFromTenant = inertMirror
export const syncLegacyOrderFromTenant = inertMirror
export const syncLegacyCustomerAccountFromTenant = inertMirror
export const syncLegacyCouponFromTenant = inertMirror
export const syncLegacyFeedbackFromTenant = inertMirror
export const syncLegacyCashSessionFromTenant = inertMirror
export const syncLegacyFinancialEntryFromTenant = inertMirror
export const syncLegacyDeliveryZoneFromTenant = inertMirror
export const syncLegacyCourierFromTenant = inertMirror
export const syncLegacyStaffMemberFromTenant = inertMirror

export async function removeLegacyDeliveryZoneMirror(_id: number) {
  return false
}
