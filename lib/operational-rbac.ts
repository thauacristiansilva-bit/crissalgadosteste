import { AsyncLocalStorage } from "node:async_hooks"
import { getPostgresPool } from "@/lib/postgres"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import type { OrganizationRole } from "@/lib/tenant-context"
import {
  getCustomPermissionsFromStorage,
  getRolePermissionPreset,
  permissionListHas,
  storedPermissionsAreCustom,
  type OperationalPermission,
} from "@/lib/operational-permissions"

export type OperationalPermissionMode = "role" | "custom"

export type OperationalAccessContext = {
  organizationId: string
  userId: string
  role: OrganizationRole
  mode: OperationalPermissionMode
  staffMemberId: number | null
  permissions: OperationalPermission[]
}

type StaffPermissionRow = {
  id: number
  permissions: string[]
  active: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var __saborflowOperationalAccessStorage:
    | AsyncLocalStorage<OperationalAccessContext>
    | undefined
}

const storage =
  globalThis.__saborflowOperationalAccessStorage ??
  new AsyncLocalStorage<OperationalAccessContext>()

if (!globalThis.__saborflowOperationalAccessStorage) {
  globalThis.__saborflowOperationalAccessStorage = storage
}

export function enterOperationalAccessContext(
  context: OperationalAccessContext,
) {
  storage.enterWith(context)
  return context
}

export function getCurrentOperationalAccess() {
  return storage.getStore() ?? null
}

export function currentOrRoleHasOperationalPermission(
  role: OrganizationRole,
  permission: OperationalPermission,
) {
  const current = getCurrentOperationalAccess()

  if (current) {
    return permissionListHas(current.permissions, permission)
  }

  return getRolePermissionPreset(role).includes(permission)
}

export async function getOperationalAccessForSession(input: {
  organizationId: string
  userId: string
  role: OrganizationRole
}): Promise<OperationalAccessContext> {
  if (input.role === "owner") {
    return {
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
      mode: "role",
      staffMemberId: null,
      permissions: getRolePermissionPreset(input.role),
    }
  }

  const result = await runWithTenantRlsScope(
    [input.organizationId],
    input.userId,
    () =>
      getPostgresPool().query<StaffPermissionRow>(
        `
          SELECT id, permissions, active
          FROM sf_staff_members
          WHERE organization_id = $1
            AND user_id = $2
          LIMIT 1
        `,
        [input.organizationId, input.userId],
      ),
    "tenant-session",
  )

  const staff = result.rows[0]
  const custom =
    Boolean(staff?.active) &&
    storedPermissionsAreCustom(staff?.permissions)

  return {
    organizationId: input.organizationId,
    userId: input.userId,
    role: input.role,
    mode: custom ? "custom" : "role",
    staffMemberId: staff ? Number(staff.id) : null,
    permissions: custom
      ? getCustomPermissionsFromStorage(staff.permissions)
      : getRolePermissionPreset(input.role),
  }
}

export function operationalAccessHas(
  access: Pick<OperationalAccessContext, "permissions">,
  permission: OperationalPermission,
) {
  return permissionListHas(access.permissions, permission)
}
