import { NextResponse } from "next/server"
import { canAccessIntegrations, integrationsHealth } from "@/lib/integrations-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessIntegrations(session)) {
    return NextResponse.json({ error: "Seu perfil não possui acesso às integrações." }, { status: 403 })
  }
  try {
    const health = await integrationsHealth(session)
    return NextResponse.json({
      ok: health.schemaReady && health.subscriptionActive && health.entitlementEnabled,
      phase: "23-integrations",
      ...health,
      providers: {
        resendEmail: true,
        twilioSms: true,
        metaWhatsApp: true,
        signedWebhook: true,
      },
      capabilities: {
        encryptedCredentials: true,
        serverOutbox: true,
        idempotentCampaignQueue: true,
        retryAttempts: true,
        workerDispatch: true,
        signedInboundWebhook: true,
        crmCampaignDispatch: true,
      },
      boundaries: {
        tenantIsolationPreserved: true,
        integrationEntitlementRequired: true,
        secretsNeverReturnedToBrowser: true,
        browserQueuesButDoesNotExecuteExternalDispatch: true,
        workerTokenRequiredForDispatch: true,
        marketingConsentRequiredForCampaignAudience: true,
        demoExternalEffectsBlocked: true,
        outboundWebhookHostAllowlistRequired: true,
        signedInboundWebhookDoesNotApplyBusinessSideEffectsAutomatically: true,
        rlsEnforcement: "prepared-only-until-phase-24",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "23-integrations",
        error: error instanceof Error ? error.message : "Falha ao validar integrações.",
      },
      { status: 500 },
    )
  }
}
