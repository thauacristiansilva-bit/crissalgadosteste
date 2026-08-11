import type { OrganizationRole } from "@/lib/tenant-context"

export function canManageMarketing(role: OrganizationRole) {
  return role === "owner" || role === "admin" || role === "manager"
}

export function canViewFeedback(role: OrganizationRole) {
  return role === "owner" || role === "admin" || role === "manager"
}

export function canUseCashRegister(role: OrganizationRole) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "cashier"
  )
}

export function canManageFinance(role: OrganizationRole) {
  return role === "owner" || role === "admin" || role === "manager"
}

export function canManageDeliveryOperation(role: OrganizationRole) {
  return role === "owner" || role === "admin" || role === "manager"
}
