import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getDeliveryDispatchHealth } from "@/lib/delivery-dispatch-db"
import { permissionListHas } from "@/lib/operational-permissions"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const mayInspect =
    session.role === "courier" ||
    permissionListHas(session.operationalPermissions, "delivery.manage")

  if (!mayInspect) {
    return NextResponse.json(
      { error: "Seu perfil não pode acessar a expedição." },
      { status: 403 },
    )
  }

  try {
    const health = await getDeliveryDispatchHealth({
      organizationId: session.organizationId,
      userId: session.userId,
      role: session.role,
    })

    return NextResponse.json({
      ok: health.schemaReady,
      phase: "25.3-delivery-dispatch-identity",
      organization: {
        id: session.organizationId,
        name: session.organizationName,
        slug: session.organizationSlug,
      },
      schemaReady: health.schemaReady,
      counts: health.counts,
      currentCourier: health.currentCourier
        ? {
            id: health.currentCourier.id,
            name: health.currentCourier.name,
            staffMemberId: health.currentCourier.staffMemberId ?? null,
            loginLinked: Boolean(health.currentCourier.linkedUserId),
          }
        : null,
      capabilities: {
        courierStaffIdentityLink: true,
        managerCourierAssignment: true,
        courierReceivesAssignedOrdersOnly: true,
        backendAssignmentOwnershipCheck: true,
        dedicatedCourierWorkspace: true,
        courierRouteNavigation: true,
        realtimeCustomerTracking: true,
        postgresRlsPreserved: true,
      },
      boundaries: {
        unlinkedCourierCanRemainOperationalWithoutAppLogin: true,
        courierAppRequiresLinkedStaffLogin: true,
        courierCannotOperateAnotherCourierOrder: true,
        courierRouteNavigationActive: true,
        realtimeCustomerTrackingActive: true,
      },
    }, { status: health.schemaReady ? 200 : 503 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "25.3-delivery-dispatch-identity",
        error: error instanceof Error
          ? error.message
          : "Falha ao validar expedição.",
      },
      { status: 500 },
    )
  }
}
