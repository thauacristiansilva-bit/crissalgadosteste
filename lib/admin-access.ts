import type {
  OrganizationRole,
} from "@/lib/tenant-context"

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

const allSections: AdminSection[] = [
  "overview",
  "pdv",
  "sales",
  "dre",
  "orders",
  "kitchen",
  "inventory",
  "products",
  "categories",
  "customers",
  "marketing",
  "reviews",
  "links",
  "chatbot",
  "team",
  "settings",
  "security",
]

const sectionsByRole: Record<
  OrganizationRole,
  AdminSection[]
> = {
  owner: allSections,
  admin: allSections,
  manager: [
    "overview",
    "pdv",
    "sales",
    "dre",
    "orders",
    "kitchen",
    "inventory",
    "products",
    "categories",
    "customers",
    "marketing",
    "reviews",
    "links",
    "chatbot",
    "security",
  ],
  cashier: [
    "overview",
    "pdv",
    "sales",
    "orders",
    "customers",
    "security",
  ],
  kitchen: [
    "orders",
    "kitchen",
    "security",
  ],
  courier: [
    "orders",
    "security",
  ],
  member: [
    "overview",
    "security",
  ],
}

export function getAllowedAdminSections(
  role: OrganizationRole,
) {
  return sectionsByRole[role]
}

export function canAccessAdminSection(
  role: OrganizationRole,
  section: AdminSection,
) {
  return sectionsByRole[
    role
  ].includes(section)
}

export function canReadOrders(
  role: OrganizationRole,
) {
  return [
    "owner",
    "admin",
    "manager",
    "cashier",
    "kitchen",
    "courier",
  ].includes(role)
}

export function canReadCustomers(
  role: OrganizationRole,
) {
  return [
    "owner",
    "admin",
    "manager",
    "cashier",
  ].includes(role)
}

export function canReadFinance(
  role: OrganizationRole,
) {
  return [
    "owner",
    "admin",
    "manager",
    "cashier",
  ].includes(role)
}

export function canReadCatalog(
  role: OrganizationRole,
) {
  return [
    "owner",
    "admin",
    "manager",
    "cashier",
  ].includes(role)
}

export function canReadMarketing(
  role: OrganizationRole,
) {
  return [
    "owner",
    "admin",
    "manager",
  ].includes(role)
}

export function canReadTeam(
  role: OrganizationRole,
) {
  return (
    role === "owner" ||
    role === "admin"
  )
}

export function canManageSecurity(
  role: OrganizationRole,
) {
  return (
    role === "owner" ||
    role === "admin"
  )
}


export function canUsePdv(
  role: OrganizationRole,
) {
  return [
    "owner",
    "admin",
    "manager",
    "cashier",
  ].includes(role)
}

export function canUpdateOrderStatus(
  role: OrganizationRole,
) {
  return [
    "owner",
    "admin",
    "manager",
    "cashier",
    "kitchen",
    "courier",
  ].includes(role)
}

export function canUpdatePaymentStatus(
  role: OrganizationRole,
) {
  return [
    "owner",
    "admin",
    "manager",
    "cashier",
  ].includes(role)
}

export function canAssignCourier(
  role: OrganizationRole,
) {
  return [
    "owner",
    "admin",
    "manager",
  ].includes(role)
}
