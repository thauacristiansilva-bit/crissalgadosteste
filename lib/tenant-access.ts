import type { AdminSession } from "@/lib/auth"
import { getAdminSession } from "@/lib/auth"
import { demoOrganizationIsUsable, touchDemoEnvironment } from "@/lib/demo-policy"
import {
  getOrganizationContextForUser,
  type OrganizationRole,
} from "@/lib/tenant-context"

export type TenantAdminSession = Extract<
  AdminSession,
  { mode: "tenant" }
>

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

  return {
    mode: "tenant",
    ...current,
    expiresAt: session.expiresAt,
  }
}

export function canManageCatalog(
  role: OrganizationRole,
) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager"
  )
}
