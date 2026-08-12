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
  sessionVersion: number
}

export interface OrganizationMembershipSummary
  extends AdminTenantContext {
  organizationStatus:
    | "active"
    | "trial"
    | "suspended"
    | "cancelled"
  onboardingStatus: "pending" | "complete"
  publicStoreEnabled: boolean
  publicOrderingEnabled: boolean
}

const rolePriority: Record<
  OrganizationRole,
  number
> = {
  owner: 1,
  admin: 2,
  manager: 3,
  cashier: 4,
  kitchen: 5,
  courier: 6,
  member: 7,
}

type OrganizationMembershipRow = {
  user_id: string
  email: string
  organization_id: string
  organization_name: string
  organization_slug: string
  organization_status:
    | "active"
    | "trial"
    | "suspended"
    | "cancelled"
  onboarding_status:
    | "pending"
    | "complete"
  public_store_enabled: boolean
  public_ordering_enabled: boolean
  role: OrganizationRole
  session_version: number
}

function mapSummary(
  row: OrganizationMembershipRow,
): OrganizationMembershipSummary {
  return {
    userId: row.user_id,
    email: row.email,
    organizationId:
      row.organization_id,
    organizationName:
      row.organization_name,
    organizationSlug:
      row.organization_slug,
    organizationStatus:
      row.organization_status,
    onboardingStatus:
      row.onboarding_status,
    publicStoreEnabled:
      Boolean(row.public_store_enabled),
    publicOrderingEnabled:
      Boolean(
        row.public_ordering_enabled,
      ),
    role: row.role,
    sessionVersion: Number(row.session_version || 1),
  }
}

function activeSummaryQuery(
  where: string,
) {
  return `
    SELECT
      u.id AS user_id,
      u.email,
      o.id AS organization_id,
      o.trade_name AS organization_name,
      o.slug AS organization_slug,
      o.status AS organization_status,
      o.onboarding_status,
      o.public_store_enabled,
      o.public_ordering_enabled,
      m.role,
      u.session_version
    FROM sf_users u
    INNER JOIN sf_memberships m
      ON m.user_id = u.id
     AND m.status = 'active'
    INNER JOIN sf_organizations o
      ON o.id = m.organization_id
     AND o.status IN ('active', 'trial')
    WHERE ${where}
      AND u.status = 'active'
    ORDER BY m.created_at ASC
  `
}

function sortSummaries(
  values: OrganizationMembershipSummary[],
) {
  return values.sort(
    (a, b) =>
      rolePriority[a.role] -
        rolePriority[b.role] ||
      a.organizationName.localeCompare(
        b.organizationName,
        "pt-BR",
      ),
  )
}

export async function listOrganizationMembershipsForUser(
  email: string,
): Promise<OrganizationMembershipSummary[]> {
  const result =
    await getPostgresPool().query<OrganizationMembershipRow>(
      activeSummaryQuery(
        "lower(u.email) = lower($1)",
      ),
      [email.trim()],
    )

  return sortSummaries(
    result.rows.map(mapSummary),
  )
}

export async function listOrganizationMembershipsForUserId(
  userId: string,
): Promise<OrganizationMembershipSummary[]> {
  const result =
    await getPostgresPool().query<OrganizationMembershipRow>(
      activeSummaryQuery("u.id = $1"),
      [userId],
    )

  return sortSummaries(
    result.rows.map(mapSummary),
  )
}

export async function listOrganizationsForUser(
  email: string,
): Promise<AdminTenantContext[]> {
  const organizations =
    await listOrganizationMembershipsForUser(
      email,
    )

  return organizations.map(
    ({
      organizationStatus: _status,
      onboardingStatus: _onboarding,
      publicStoreEnabled: _store,
      publicOrderingEnabled: _ordering,
      ...context
    }) => context,
  )
}

export async function listOrganizationsForUserId(
  userId: string,
): Promise<AdminTenantContext[]> {
  const organizations =
    await listOrganizationMembershipsForUserId(
      userId,
    )

  return organizations.map(
    ({
      organizationStatus: _status,
      onboardingStatus: _onboarding,
      publicStoreEnabled: _store,
      publicOrderingEnabled: _ordering,
      ...context
    }) => context,
  )
}

export async function getDefaultAdminTenantContext(
  email: string,
): Promise<AdminTenantContext | null> {
  const organizations =
    await listOrganizationsForUser(email)

  return organizations[0] ?? null
}

export async function getDefaultAdminTenantContextForUserId(
  userId: string,
): Promise<AdminTenantContext | null> {
  const organizations =
    await listOrganizationsForUserId(
      userId,
    )

  return organizations[0] ?? null
}

export async function getOrganizationContextForUser(
  userId: string,
  organizationId: string,
): Promise<AdminTenantContext | null> {
  const result =
    await getPostgresPool().query<OrganizationMembershipRow>(
      `
        ${activeSummaryQuery(
          "u.id = $1 AND o.id = $2",
        )}
      `,
      [userId, organizationId],
    )

  const row = result.rows[0]
  if (!row) return null

  const {
    organizationStatus: _status,
    onboardingStatus: _onboarding,
    publicStoreEnabled: _store,
    publicOrderingEnabled: _ordering,
    ...context
  } = mapSummary(row)

  return context
}

export async function membershipExists(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  return Boolean(
    await getOrganizationContextForUser(
      userId,
      organizationId,
    ),
  )
}
