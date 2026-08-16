import type { AdminSession } from "@/lib/auth"
import { getAdminSession } from "@/lib/auth"
import { demoOrganizationIsUsable, touchDemoEnvironment } from "@/lib/demo-policy"
import {
  currentOrRoleHasOperationalPermission,
  enterOperationalAccessContext,
  getOperationalAccessForSession,
  type OperationalPermissionMode,
} from "@/lib/operational-rbac"
import type { OperationalPermission } from "@/lib/operational-permissions"
import {
  getOrganizationContextForUser,
  type OrganizationRole,
} from "@/lib/tenant-context"
import { enterTenantRlsContext } from "@/lib/rls-context"

export type TenantAdminSession = Extract<
  AdminSession,
  { mode: "tenant" }
> & {
  operationalPermissions: OperationalPermission[]
  operationalPermissionMode: OperationalPermissionMode
  staffMemberId: number | null
}

export async function getVerifiedTenantSession():
  Promise<TenantAdminSession | null> {
  const session = await getAdminSession()

  if (
    !session ||
    session.mode !== "tenant"
  ) {
    return null
  }

  if (!(await demoOrganizationIsUsable(session.organizationId))) {
    return null
  }

  const current =
    await getOrganizationContextForUser(
      session.userId,
      session.organizationId,
    )

  if (!current) return null

  if (
    current.sessionVersion !==
    session.sessionVersion
  ) {
    return null
  }

  await touchDemoEnvironment(session.organizationId)

  // Reafirma o tenant após verificações que usam AsyncLocalStorage.run().
  // A Fase 25-R1 depende deste limite para manter o RLS efetivo nas consultas
  // administrativas e a Fase 25.1 reutiliza o mesmo escopo para resolver RBAC.
  enterTenantRlsContext(
    session.organizationId,
    session.userId,
    "tenant-session",
  )

  const access = await getOperationalAccessForSession(current)
  enterOperationalAccessContext(access)

  // A resolução do RBAC também abre um escopo RLS explícito; reafirmamos o
  // tenant no retorno para que as consultas seguintes continuem fail-closed
  // para qualquer outra organização.
  enterTenantRlsContext(
    session.organizationId,
    session.userId,
    "tenant-session",
  )

  return {
    mode: "tenant",
    ...current,
    expiresAt: session.expiresAt,
    operationalPermissions: access.permissions,
    operationalPermissionMode: access.mode,
    staffMemberId: access.staffMemberId,
  }
}

export function canManageCatalog(
  role: OrganizationRole,
) {
  return currentOrRoleHasOperationalPermission(role, "catalog.manage")
}
