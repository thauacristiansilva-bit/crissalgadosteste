import { NextResponse } from "next/server"
import { canAccessManagementReports, reportsSchemaHealth } from "@/lib/reports-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessManagementReports(session)) return NextResponse.json({ error: "Seu perfil não possui acesso aos relatórios gerenciais." }, { status: 403 })

  try {
    const health = await reportsSchemaHealth(session)
    return NextResponse.json({
      ok: health.schemaReady && health.entitlementEnabled && health.subscriptionActive,
      phase: "20-reports-intelligence",
      ...health,
      capabilities: {
        organizationReports: true,
        corporateConsolidation: health.groupAvailable,
        previousPeriodComparison: true,
        productRanking: true,
        customerRecurrence: true,
        csvExport: true,
      },
      boundaries: {
        readOnlyAnalytics: true,
        tenantIsolationPreserved: true,
        groupReadDoesNotGrantTenantWrite: true,
        advancedReportsEntitlementRequired: true,
        rlsEnforcement: "prepared-only-until-phase-24",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "20-reports-intelligence",
        error: error instanceof Error ? error.message : "Falha ao validar relatórios.",
      },
      { status: 500 },
    )
  }
}
