import { NextResponse } from "next/server"
import { getCourierWorkspaceSnapshot } from "@/lib/delivery-dispatch-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getDefaultOperationalPath } from "@/lib/operational-home"
import { canReadOrders } from "@/lib/admin-access"
import { getTenantRecentOrders } from "@/lib/order-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const sessionContext = {
    email: session.email,
    role: session.role,
    workspace: getDefaultOperationalPath(
      session.role,
      session.operationalPermissions,
    ),
  }

  if (!canReadOrders(session.role, session.operationalPermissions)) {
    return NextResponse.json({ orders: [], sessionContext })
  }

  const orders = await runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    () => getTenantRecentOrders(session.organizationId, 120),
    "tenant-session",
  )

  if (session.role !== "courier") {
    return NextResponse.json({ orders, sessionContext })
  }

  const dispatch = await getCourierWorkspaceSnapshot({
    organizationId: session.organizationId,
    userId: session.userId,
    role: session.role,
    permissions: session.operationalPermissions,
  })
  const visibleOrderIds = new Set(dispatch.orders.map((order) => order.id))

  return NextResponse.json({
    orders: orders.filter((order) => visibleOrderIds.has(order.id)),
    sessionContext,
  })
}
