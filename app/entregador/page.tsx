import { redirect } from "next/navigation"
import { CourierWorkspace } from "@/components/operational/courier-workspace"
import { canAccessOperationalWorkspace, getDefaultOperationalPath } from "@/lib/operational-home"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getTenantAwareAdminData } from "@/lib/tenant-admin-data"

export const dynamic = "force-dynamic"

export default async function CourierPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")

  if (!canAccessOperationalWorkspace("courier", session.role, session.operationalPermissions)) {
    redirect(getDefaultOperationalPath(session.role, session.operationalPermissions))
  }

  const data = await getTenantAwareAdminData(session, session.operationalPermissions)

  return (
    <CourierWorkspace
      organizationName={session.organizationName}
      initialOrders={data.orders}
    />
  )
}
