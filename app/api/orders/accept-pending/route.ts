import { NextResponse } from "next/server"
import { canUpdateOrderStatus } from "@/lib/admin-access"
import { getTenantOrders, isTenantOrdersReady, updateTenantOrder } from "@/lib/order-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export async function POST() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  if (
    session.role === "courier" ||
    !canUpdateOrderStatus(session.role, session.operationalPermissions)
  ) {
    return NextResponse.json(
      { error: "Seu perfil não pode aceitar pedidos." },
      { status: 403 },
    )
  }

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () => {
      const ready = await isTenantOrdersReady(session.organizationId).catch(() => false)
      if (!ready) {
        return NextResponse.json(
          { error: "Pedidos PostgreSQL desta empresa não estão disponíveis." },
          { status: 503 },
        )
      }

      const pending = (await getTenantOrders(session.organizationId)).filter(
        (order) => order.status === "pending",
      )

      const updated = []
      for (const order of pending) {
        const next = await updateTenantOrder(session.organizationId, order.id, {
          status: "accepted",
        })
        if (next) updated.push(next)
      }

      return NextResponse.json({
        acceptedCount: updated.length,
        orders: updated,
      })
    },
    "tenant-session",
  )
}
