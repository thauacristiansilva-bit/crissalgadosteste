import { NextResponse } from "next/server"
import {
  getCashSessions,
  getCoupons,
  getCouriers,
  getDeliveryZones,
  getFeedbacks,
  getFinancialEntries,
} from "@/lib/db"
import {
  getTenantOperationsStats,
} from "@/lib/operations-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function signedFinancialTotal(
  entries: Awaited<ReturnType<typeof getFinancialEntries>>,
) {
  return Number(
    entries
      .reduce(
        (sum, entry) =>
          sum +
          (entry.type === "income"
            ? entry.amount
            : -entry.amount),
        0,
      )
      .toFixed(2),
  )
}

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: "Sessão multiempresa inválida.",
      },
      { status: 401 },
    )
  }

  try {
    const stats = await getTenantOperationsStats(
      session.organizationId,
    )

    const mirrorEnabled =
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )

    let legacy:
      | {
          coupons: number
          feedbacks: number
          cashSessions: number
          financialEntries: number
          deliveryZones: number
          couriers: number
          financialSignedTotal: number
        }
      | null = null

    if (mirrorEnabled) {
      const [
        coupons,
        feedbacks,
        cashSessions,
        financialEntries,
        deliveryZones,
        couriers,
      ] = await Promise.all([
        getCoupons({ includeInactive: true }),
        getFeedbacks(),
        getCashSessions(),
        getFinancialEntries(),
        getDeliveryZones({
          includeInactive: true,
        }),
        getCouriers({ includeInactive: true }),
      ])

      legacy = {
        coupons: coupons.length,
        feedbacks: feedbacks.length,
        cashSessions: cashSessions.length,
        financialEntries: financialEntries.length,
        deliveryZones: deliveryZones.length,
        couriers: couriers.length,
        financialSignedTotal:
          signedFinancialTotal(financialEntries),
      }
    }

    const countsMatch =
      !legacy ||
      (legacy.coupons === stats.coupons &&
        legacy.feedbacks === stats.feedbacks &&
        legacy.cashSessions === stats.cashSessions &&
        legacy.financialEntries ===
          stats.financialEntries &&
        legacy.deliveryZones ===
          stats.deliveryZones &&
        legacy.couriers === stats.couriers &&
        Math.abs(
          legacy.financialSignedTotal -
            stats.financialSignedTotal,
        ) < 0.01)

    return NextResponse.json({
      ok: stats.ready && countsMatch,
      organization: {
        id: session.organizationId,
        name: session.organizationName,
        slug: session.organizationSlug,
      },
      role: session.role,
      operations: stats,
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
            : "Não foi possível consultar a operação.",
      },
      { status: 503 },
    )
  }
}
