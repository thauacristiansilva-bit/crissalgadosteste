import { getPostgresPool } from "@/lib/postgres"

export type OrganizationRole =
  | "owner"
  | "admin"
  | "manager"
  | "cashier"
  | "kitchen"
  | "courier"
  | "member"

export interface AdminTenantContext {
  userId: string
  email: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  role: OrganizationRole
}

const rolePriority: Record<OrganizationRole, number> = {
  owner: 1,
  admin: 2,
  manager: 3,
  cashier: 4,
  kitchen: 5,
  courier: 6,
  member: 7,
}

export async function listOrganizationsForUser(email: string): Promise<AdminTenantContext[]> {
  const result = await getPostgresPool().query<{
    user_id: string
    email: string
    organization_id: string
    organization_name: string
    organization_slug: string
    role: OrganizationRole
  }>(
    `
      SELECT
        u.id AS user_id,
        u.email,
        o.id AS organization_id,
        o.trade_name AS organization_name,
        o.slug AS organization_slug,
        m.role
      FROM sf_users u
      INNER JOIN sf_memberships m
        ON m.user_id = u.id
       AND m.status = 'active'
      INNER JOIN sf_organizations o
        ON o.id = m.organization_id
       AND o.status IN ('active', 'trial')
      WHERE lower(u.email) = lower($1)
        AND u.status = 'active'
      ORDER BY m.created_at ASC
    `,
    [email.trim()],
  )

  return result.rows
    .map((row) => ({
      userId: row.user_id,
      email: row.email,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      organizationSlug: row.organization_slug,
      role: row.role,
    }))
    .sort((a, b) => rolePriority[a.role] - rolePriority[b.role])
}

export async function getDefaultAdminTenantContext(
  email: string,
): Promise<AdminTenantContext | null> {
  const organizations = await listOrganizationsForUser(email)
  return organizations[0] ?? null
}

export async function membershipExists(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const result = await getPostgresPool().query(
    `
      SELECT 1
      FROM sf_memberships
      WHERE user_id = $1
        AND organization_id = $2
        AND status = 'active'
      LIMIT 1
    `,
    [userId, organizationId],
  )

  return Boolean(result.rowCount)
}
