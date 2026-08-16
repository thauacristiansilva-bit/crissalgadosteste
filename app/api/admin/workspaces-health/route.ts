import { NextResponse } from "next/server"
import {
  canAccessOperationalWorkspace,
  getDefaultOperationalPath,
} from "@/lib/operational-home"
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

  return NextResponse.json({
    ok: true,
    phase: "25.2-dedicated-operational-workspaces",
    organization: {
      id: session.organizationId,
      name: session.organizationName,
      slug: session.organizationSlug,
    },
    currentAccess: {
      role: session.role,
      permissionMode: session.operationalPermissionMode,
      defaultPath: getDefaultOperationalPath(
        session.role,
        session.operationalPermissions,
      ),
    },
    workspaces: {
      manager: {
        path: "/gerente",
        allowed: canAccessOperationalWorkspace("manager", session.role, session.operationalPermissions),
      },
      pdv: {
        path: "/pdv",
        allowed: canAccessOperationalWorkspace("pdv", session.role, session.operationalPermissions),
      },
      kitchen: {
        path: "/cozinha",
        allowed: canAccessOperationalWorkspace("kitchen", session.role, session.operationalPermissions),
      },
      courier: {
        path: "/entregador",
        allowed: canAccessOperationalWorkspace("courier", session.role, session.operationalPermissions),
      },
    },
    capabilities: {
      roleAwareAdminRedirect: true,
      dedicatedManagerWorkspace: true,
      dedicatedPdvWorkspace: true,
      dedicatedKitchenWorkspace: true,
      dedicatedCourierWorkspace: true,
      courierAssignmentIdentity: true,
      courierRouteNavigation: true,
      realtimeCustomerTracking: true,
      backendRbacPreserved: true,
      postgresRlsPreserved: true,
    },
    boundaries: {
      pdvReceivesOrdersWithoutKitchenControls: true,
      kitchenControlsPreparationOnly: true,
      courierControlsDeliveryStatusOnly: true,
      courierAssignmentIdentityActive: true,
      courierRouteNavigationActive: true,
      realtimeCustomerTrackingActive: true,
    },
  })
}
