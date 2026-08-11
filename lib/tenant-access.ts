import type { AdminSession } from "@/lib/auth"
import { getAdminSession } from "@/lib/auth"
import { membershipExists, type OrganizationRole } from "@/lib/tenant-context"

export type TenantAdminSession = Extract<AdminSession, { mode: "tenant" }>

export async function getVerifiedTenantSession(): Promise<TenantAdminSession | null> {
  const session = await getAdminSession()
  if (!session || session.mode !== "tenant") return null

  const active = await membershipExists(
    session.userId,
    session.organizationId,
  )

  return active ? session : null
}

export function canManageCatalog(role: OrganizationRole) {
  return role === "owner" || role === "admin" || role === "manager"
}
