import { redirect } from "next/navigation"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { getAdminEmail } from "@/lib/auth"
import { getDemoEnvironmentForOrganization } from "@/lib/demo-policy"
import { canAccessOperationalWorkspace, getDefaultOperationalPath } from "@/lib/operational-home"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getTenantAwareAdminData } from "@/lib/tenant-admin-data"

export const dynamic = "force-dynamic"

export default async function ManagerPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")

  if (!canAccessOperationalWorkspace("manager", session.role, session.operationalPermissions)) {
    redirect(getDefaultOperationalPath(session.role, session.operationalPermissions))
  }

  const demoEnvironment = await getDemoEnvironmentForOrganization(session.organizationId)

  return (
    <AdminDashboard
      adminEmail={session.email || getAdminEmail()}
      adminRole={session.role}
      operationalPermissions={session.operationalPermissions}
      demoEnvironment={demoEnvironment ? {
        kind: demoEnvironment.kind,
        expiresAt: demoEnvironment.expiresAt,
      } : null}
      organizationSlug={session.organizationSlug}
      initialData={await getTenantAwareAdminData(session, session.operationalPermissions)}
    />
  )
}
