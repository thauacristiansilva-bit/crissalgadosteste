import { NextResponse } from "next/server"
import { getCourierWorkspaceSnapshot } from "@/lib/delivery-dispatch-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getTenantAwareAdminData } from "@/lib/tenant-admin-data"
import { getDefaultOperationalPath } from "@/lib/operational-home"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const data = await getTenantAwareAdminData(
    session,
    session.operationalPermissions,
  )
  const sessionContext = {
    email: session.email,
    role: session.role,
    workspace: getDefaultOperationalPath(
      session.role,
      session.operationalPermissions,
    ),
  }

  if (session.role !== "courier") {
    return NextResponse.json({
      ...data,
      sessionContext,
    })
  }

  const dispatch = await getCourierWorkspaceSnapshot({
    organizationId: session.organizationId,
    userId: session.userId,
    role: session.role,
    permissions: session.operationalPermissions,
  })

  const visibleOrderIds = new Set(dispatch.orders.map((order) => order.id))

  return NextResponse.json({
    ...data,
    sessionContext,
    orders: data.orders.filter((order) => visibleOrderIds.has(order.id)),
    couriers: dispatch.courier ? [dispatch.courier] : [],
    courierIdentity: dispatch.courier
      ? {
          id: dispatch.courier.id,
          name: dispatch.courier.name,
          staffMemberId: dispatch.courier.staffMemberId ?? null,
        }
      : null,
  })
}
