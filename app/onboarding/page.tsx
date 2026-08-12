import { redirect } from "next/navigation"
import { CommercialOnboarding } from "@/components/onboarding/commercial-onboarding"
import { getCommercialOnboardingSnapshot } from "@/lib/commercial-onboarding"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export default async function OnboardingPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")
  if (session.role !== "owner") redirect("/admin")

  const onboarding = await getCommercialOnboardingSnapshot(session.organizationId)
  if (!onboarding) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">SaborFlow · Fase 15</p>
          <h1 className="mt-2 text-2xl font-black text-gray-950">Onboarding aguardando migration</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            A estrutura comercial da loja foi criada, mas a migration 014_commercial_onboarding ainda precisa ser aplicada no PostgreSQL.
          </p>
        </div>
      </main>
    )
  }

  if (onboarding.state.completed) redirect("/admin")

  return <CommercialOnboarding initialOnboarding={onboarding} />
}
