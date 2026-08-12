import { NextResponse } from "next/server"
import { getCommercialOnboardingSnapshot } from "@/lib/commercial-onboarding"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const onboarding = await getCommercialOnboardingSnapshot(session.organizationId)
  if (!onboarding) {
    return NextResponse.json({
      ok: false,
      phase: "15-commercial-onboarding",
      schemaReady: false,
      note: "Aplique a migration 014_commercial_onboarding.",
    }, { status: 503 })
  }

  return NextResponse.json({
    ok: true,
    phase: "15-commercial-onboarding",
    schemaReady: true,
    organization: {
      id: onboarding.organization.id,
      name: onboarding.organization.name,
      onboardingStatus: onboarding.organization.onboardingStatus,
      publicStoreEnabled: onboarding.organization.publicStoreEnabled,
      publicOrderingEnabled: onboarding.organization.publicOrderingEnabled,
    },
    onboarding: {
      version: onboarding.state.version,
      currentStep: onboarding.state.currentStep,
      completedSteps: onboarding.state.completedSteps,
      completed: onboarding.state.completed,
      publishedAt: onboarding.state.publishedAt,
    },
    catalog: onboarding.catalog,
    billing: onboarding.billing,
    readiness: onboarding.readiness,
    authority: "server-validated-active-subscription",
  })
}
