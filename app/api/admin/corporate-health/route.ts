import { NextResponse } from "next/server"
import { corporateSchemaHealth } from "@/lib/corporate-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    const health = await corporateSchemaHealth(session)
    return NextResponse.json({
      ok: health.schemaReady && health.currentAccountLinked,
      phase: "19-corporate-groups",
      ...health,
      boundaries: {
        sameBillingAccountOnly: true,
        consolidatedReadDoesNotGrantTenantWrite: true,
        operationalAccessRequiresTenantMembership: true,
        exactlyOneHeadquartersPerActiveGroup: true,
        rlsEnforcement: "prepared-only-until-phase-24",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "19-corporate-groups",
        error: error instanceof Error ? error.message : "Falha ao validar estrutura corporativa.",
      },
      { status: 500 },
    )
  }
}
