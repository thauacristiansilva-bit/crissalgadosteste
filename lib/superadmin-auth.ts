import { getAdminSession } from "@/lib/auth"
import { getPostgresPool } from "@/lib/postgres"

export type PlatformAdminRole = "owner" | "operator" | "support" | "finance"

export type SuperadminAccess = {
  platformAdminId: string
  userId: string
  email: string
  role: PlatformAdminRole
}

export async function getSuperadminAccess(): Promise<SuperadminAccess | null> {
  const session = await getAdminSession()
  if (!session || session.mode !== "tenant") return null

  try {
    const result = await getPostgresPool().query<{
      id: string
      user_id: string
      email: string
      role: PlatformAdminRole
    }>(
      `
        SELECT pa.id, pa.user_id, u.email, pa.role
        FROM sf_platform_admins pa
        INNER JOIN sf_users u ON u.id = pa.user_id
        WHERE pa.user_id = $1
          AND pa.status = 'active'
          AND u.status = 'active'
        LIMIT 1
      `,
      [session.userId],
    )

    const row = result.rows[0]
    if (!row) return null
    return {
      platformAdminId: row.id,
      userId: row.user_id,
      email: row.email,
      role: row.role,
    }
  } catch (error) {
    const pgError = error as { code?: string }
    if (pgError?.code === "42P01") return null
    throw error
  }
}

export function canManageCommercialState(role: PlatformAdminRole) {
  return role === "owner" || role === "operator" || role === "finance"
}

export function canManageSupport(role: PlatformAdminRole) {
  return role === "owner" || role === "operator" || role === "support"
}

export function canManagePlatformAdmins(role: PlatformAdminRole) {
  return role === "owner"
}

export function canReviewRegistrations(role: PlatformAdminRole) {
  return role === "owner" || role === "operator"
}

export function canManagePlatformFinance(role: PlatformAdminRole) {
  return role === "owner" || role === "operator" || role === "finance"
}
