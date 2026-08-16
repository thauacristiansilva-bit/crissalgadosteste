import { NextResponse } from "next/server"
import { canUpdateOrderStatus } from "@/lib/admin-access"
import { getDefaultOperationalPath } from "@/lib/operational-home"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sessão multiempresa inválida." },
      { status: 401 },
    )
  }

  const canChangeStatus = canUpdateOrderStatus(
    session.role,
    session.operationalPermissions,
  )
  const canManagePreparation =
    canChangeStatus && session.role !== "courier"
  const canCancel =
    canChangeStatus &&
    session.role !== "courier" &&
    session.role !== "kitchen"

  return NextResponse.json({
    ok: true,
    phase: "25.7.6-scheduled-order-management-session-guard",
    organization: {
      id: session.organizationId,
      name: session.organizationName,
      slug: session.organizationSlug,
    },
    currentSession: {
      email: session.email,
      role: session.role,
      workspace: getDefaultOperationalPath(
        session.role,
        session.operationalPermissions,
      ),
      canManagePreparation,
      canCancelOrders: canCancel,
    },
    scheduledOrders: {
      scheduledFlagBlocksPreparation: false,
      scheduledFlagBlocksCancellation: false,
      managementCanStartPreparationManually: true,
      managementCanCancelBeforeCompletion: true,
    },
    protections: {
      courierCannotAcceptOrPrepareOrders: true,
      courierCannotCancelOrders: true,
      courierOnlyAdvancesReadyToInRouteToCompleted: true,
      staleAdminScreenDetectsSessionRoleChange: true,
      managementAndCourierShouldUseSeparateBrowserProfilesOrDevices: true,
    },
  })
}
