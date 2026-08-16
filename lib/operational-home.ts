import type { OrganizationRole } from "@/lib/tenant-context"
import {
  permissionListHas,
  type OperationalPermission,
} from "@/lib/operational-permissions"

export type OperationalWorkspace =
  | "manager"
  | "pdv"
  | "kitchen"
  | "courier"

export type OperationalWorkspacePath =
  | "/admin"
  | "/gerente"
  | "/pdv"
  | "/cozinha"
  | "/entregador"

function has(
  permissions: readonly OperationalPermission[],
  permission: OperationalPermission,
) {
  return permissionListHas(permissions, permission)
}

export function getDefaultOperationalPath(
  role: OrganizationRole,
  permissions: readonly OperationalPermission[],
): OperationalWorkspacePath {
  if (role === "owner" || role === "admin") return "/admin"

  if (role === "manager") return "/gerente"

  if (role === "cashier" && has(permissions, "pdv.use")) {
    return "/pdv"
  }

  if (role === "kitchen" && has(permissions, "kitchen.use")) {
    return "/cozinha"
  }

  if (
    role === "courier" &&
    has(permissions, "orders.view") &&
    has(permissions, "orders.status.update")
  ) {
    return "/entregador"
  }

  return "/admin"
}

export function canAccessOperationalWorkspace(
  workspace: OperationalWorkspace,
  role: OrganizationRole,
  permissions: readonly OperationalPermission[],
) {
  if (workspace === "manager") {
    return role === "owner" || role === "admin" || role === "manager"
  }

  if (workspace === "pdv") {
    return has(permissions, "pdv.use")
  }

  if (workspace === "kitchen") {
    return has(permissions, "kitchen.use")
  }

  return (
    has(permissions, "delivery.manage") ||
    (role === "courier" &&
      has(permissions, "orders.view") &&
      has(permissions, "orders.status.update"))
  )
}
