import { NextResponse } from "next/server"
import {
  getOrders as getLegacyOrders,
} from "@/lib/db"
import {
  getTenantOrdersStats,
  isTenantOrdersReady,
} from "@/lib/order-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function moneyTotal(orders: Awaited<ReturnType<typeof getLegacyOrders>>) {
  return Number(
    orders
      .reduce((sum, order) => sum + Number(order.total || 0), 0)
      .toFixed(2),
  )
}

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sessão multiempresa inválida." },
      { status: 401 },
    )
  }

  try {
    const stats = await getTenantOrdersStats(session.organizationId)
    const mirrorEnabled = await isCurrentDeploymentOrganization(
      session.organizationId,
    )

    let legacy:
      | {
          orders: number
          items: number
          totalAmount: number
        }
      | null = null

    if (mirrorEnabled) {
      const orders = await getLegacyOrders()

      legacy = {
        orders: orders.length,
        items: orders.reduce(
          (sum, order) => sum + order.items.length,
          0,
        ),
        totalAmount: moneyTotal(orders),
      }
    }

    const countsMatch =
      !legacy ||
      (legacy.orders === stats.orders &&
        legacy.items === stats.items &&
        Math.abs(legacy.totalAmount - stats.totalAmount) < 0.01)

    return NextResponse.json({
      ok: stats.ready && countsMatch,
      organization: {
        id: session.organizationId,
        name: session.organizationName,
        slug: session.organizationSlug,
      },
      role: session.role,
      orders: stats,
      transition: {
        legacyMirrorEnabled: mirrorEnabled,
        legacy,
        countsMatch,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar os pedidos.",
      },
      { status: 503 },
    )
  }
}
