import type { OrganizationRole } from "@/lib/tenant-context"
import {
  currentOrRoleHasOperationalPermission,
} from "@/lib/operational-rbac"

export function canManageMarketing(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "marketing.manage")
}

export function canViewFeedback(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "marketing.view")
}

export function canUseCashRegister(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "cash.manage")
}

export function canViewFinance(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "finance.view")
}

export function canManageFinance(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "finance.manage")
}

export function canManageDeliveryOperation(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "delivery.manage")
}

export function canViewOrganizationSettings(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "settings.view")
}

export function canManageOrganizationSettings(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "settings.manage")
}

export function canViewTeam(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "team.view")
}

export function canManageTeam(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "team.manage")
}

export function canManageAccess(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "access.manage")
}

export function canViewCustomers(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "customers.view")
}

export function canManageCustomers(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "customers.manage")
}

export function canViewSecurity(role: OrganizationRole) {
  return currentOrRoleHasOperationalPermission(role, "security.view")
}
