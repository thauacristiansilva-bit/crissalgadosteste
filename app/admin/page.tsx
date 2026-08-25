import { redirect } from "next/navigation"
import { hasCurrentLegalAcceptance } from "@/lib/legal-db"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { getAdminEmail, getAdminSession } from "@/lib/auth"
import { getTenantAwareAdminData } from "@/lib/tenant-admin-data"
import { getOperationalAccessForSession } from "@/lib/operational-rbac"
import { getDefaultOperationalPath } from "@/lib/operational-home"
import { getCommercialOnboardingSnapshot } from "@/lib/commercial-onboarding"
import { demoOrganizationIsUsable, getDemoEnvironmentForOrganization } from "@/lib/demo-policy"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const session = await getAdminSession()
  if (!session) redirect("/login")

  let demoEnvironment = null
  if (session.mode === "tenant") {
    if (!(await demoOrganizationIsUsable(session.organizationId))) {
      redirect("/demo?expired=1")
    }
    demoEnvironment = await getDemoEnvironmentForOrganization(session.organizationId)
  }

  if (!demoEnvironment && !(await hasCurrentLegalAcceptance(session.userId))) redirect("/legal/aceite")

  if (session.mode === "tenant" && session.role === "owner") {
    const onboarding = await getCommercialOnboardingSnapshot(session.organizationId)
    if (onboarding && !onboarding.state.completed) redirect("/onboarding")
  }

  const access = session.mode === "tenant"
    ? await getOperationalAccessForSession(session)
    : null

  if (session.mode === "tenant" && access) {
    const operationalHome = getDefaultOperationalPath(
      session.role,
      access.permissions,
    )
    if (operationalHome !== "/admin") redirect(operationalHome)
  }

  return (
    <AdminDashboard
      adminEmail={session.email || getAdminEmail()}
      adminRole={session.mode === "tenant" ? session.role : "owner"}
      operationalPermissions={access?.permissions || []}
      demoEnvironment={demoEnvironment ? {
        kind: demoEnvironment.kind,
        expiresAt: demoEnvironment.expiresAt,
      } : null}
      organizationSlug={session.mode === "tenant" ? session.organizationSlug : null}
      initialData={await getTenantAwareAdminData(session, access?.permissions)}
    />
  )
}
