import { NextResponse } from "next/server"
import {
  CUSTOM_PERMISSION_MARKER,
  OPERATIONAL_PERMISSION_CATALOG,
  ROLE_PERMISSION_PRESETS,
} from "@/lib/operational-permissions"
import { getPostgresPool } from "@/lib/postgres"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const result = await getPostgresPool().query<{
    staff_members: number
    linked_logins: number
    custom_profiles: number
  }>(
    `
      SELECT
        COUNT(*)::int AS staff_members,
        COUNT(*) FILTER (WHERE user_id IS NOT NULL)::int AS linked_logins,
        COUNT(*) FILTER (WHERE permissions ? $2)::int AS custom_profiles
      FROM sf_staff_members
      WHERE organization_id = $1
    `,
    [session.organizationId, CUSTOM_PERMISSION_MARKER],
  )

  const counts = result.rows[0] || {
    staff_members: 0,
    linked_logins: 0,
    custom_profiles: 0,
  }

  return NextResponse.json({
    ok: true,
    phase: "25.1-operational-rbac",
    organization: {
      id: session.organizationId,
      name: session.organizationName,
      slug: session.organizationSlug,
    },
    currentAccess: {
      userId: session.userId,
      role: session.role,
      mode: session.operationalPermissionMode,
      staffMemberId: session.staffMemberId,
      permissionCount: session.operationalPermissions.length,
      permissions: session.operationalPermissions,
    },
    counts: {
      staffMembers: Number(counts.staff_members || 0),
      linkedLogins: Number(counts.linked_logins || 0),
      customProfiles: Number(counts.custom_profiles || 0),
    },
    catalog: {
      permissions: OPERATIONAL_PERMISSION_CATALOG.length,
      rolePresets: Object.fromEntries(
        Object.entries(ROLE_PERMISSION_PRESETS).map(([role, permissions]) => [
          role,
          permissions.length,
        ]),
      ),
    },
    capabilities: {
      rolePresets: true,
      perEmployeeOverrides: true,
      backendAuthorization: true,
      adminNavigationFiltered: true,
      dedicatedOperationalWorkspaces: true,
      deliveryRouteNavigation: true,
      deliveryRealtimeTracking: true,
      postgresTenantIsolationPreserved: true,
    },
    boundaries: {
      ownerUsesFullPreset: true,
      managerHasFullOperationalPreset: true,
      accessGovernanceReservedByDefaultToOwnerAndAdmin: true,
      billingRemainsGovernanceControlled: true,
      customPermissionsNeverBypassRls: true,
      dedicatedRolePagesActive: true,
      deliveryTrackingActiveWithOrderPrivacy: true,
    },
  })
}
