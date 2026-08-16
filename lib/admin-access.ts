import type { OrganizationRole } from "@/lib/tenant-context"
import {
  getRolePermissionPreset,
  permissionListHas,
  type OperationalPermission,
} from "@/lib/operational-permissions"

export type AdminSection =
  | "overview"
  | "pdv"
  | "sales"
  | "dre"
  | "orders"
  | "kitchen"
  | "inventory"
  | "products"
  | "categories"
  | "customers"
  | "marketing"
  | "reviews"
  | "links"
  | "chatbot"
  | "team"
  | "settings"
  | "security"
  | "billing"

const sectionPermission: Record<AdminSection, OperationalPermission> = {
  overview: "dashboard.view",
  pdv: "pdv.use",
  sales: "finance.view",
  dre: "finance.view",
  orders: "orders.view",
  kitchen: "kitchen.use",
  inventory: "catalog.view",
  products: "catalog.view",
  categories: "catalog.view",
  customers: "customers.view",
  marketing: "marketing.manage",
  reviews: "marketing.view",
  links: "settings.view",
  chatbot: "marketing.manage",
  team: "team.view",
  settings: "settings.view",
  security: "security.view",
  billing: "billing.view",
}

const allSections = Object.keys(sectionPermission) as AdminSection[]

function accessList(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return permissions ?? getRolePermissionPreset(role)
}

function has(
  role: OrganizationRole,
  permission: OperationalPermission,
  permissions?: readonly OperationalPermission[],
) {
  return permissionListHas(accessList(role, permissions), permission)
}

export function getAllowedAdminSections(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return allSections.filter((section) =>
    has(role, sectionPermission[section], permissions),
  )
}

export function canAccessAdminSection(
  role: OrganizationRole,
  section: AdminSection,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, sectionPermission[section], permissions)
}

export function canReadOrders(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, "orders.view", permissions)
}

export function canReadCustomers(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, "customers.view", permissions)
}

export function canReadFinance(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, "finance.view", permissions)
}

export function canReadCatalog(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, "catalog.view", permissions)
}

export function canReadMarketing(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, "marketing.view", permissions)
}

export function canReadTeam(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, "team.view", permissions)
}

export function canManageSecurity(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, "security.manage", permissions)
}

export function canUsePdv(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, "pdv.use", permissions)
}

export function canUpdateOrderStatus(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, "orders.status.update", permissions)
}

export function canUpdatePaymentStatus(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, "orders.payment.update", permissions)
}

export function canAssignCourier(
  role: OrganizationRole,
  permissions?: readonly OperationalPermission[],
) {
  return has(role, "delivery.manage", permissions)
}
