import { NextResponse } from "next/server"
import { canAccessCrm, crmHealth } from "@/lib/crm-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessCrm(session)) {
    return NextResponse.json({ error: "Seu perfil não possui acesso ao CRM e fidelidade." }, { status: 403 })
  }

  try {
    const health = await crmHealth(session)
    return NextResponse.json({
      ok: health.schemaReady && health.entitlementEnabled && health.subscriptionActive,
      phase: "21-crm-loyalty-marketing",
      ...health,
      capabilities: {
        customerSegmentation: true,
        customerTagsAndNotes: true,
        marketingConsent: true,
        loyaltyLedger: true,
        rewardRedemption: true,
        campaignPlanning: true,
        externalBulkDispatch: false,
      },
      boundaries: {
        tenantIsolationPreserved: true,
        loyaltyEntitlementRequired: true,
        pointsEarnOnlyOnCompletedOrders: true,
        completedOrderCancellationReversesAvailablePoints: true,
        marketingConsentRequiredForCampaignAudience: true,
        browserCannotDispatchExternalBulkMessages: true,
        integrationsReservedForPhase23: true,
        rlsEnforcement: "prepared-only-until-phase-24",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "21-crm-loyalty-marketing",
        error: error instanceof Error ? error.message : "Falha ao validar CRM e fidelidade.",
      },
      { status: 500 },
    )
  }
}
