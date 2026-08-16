import { redirect } from "next/navigation"
import { KitchenWorkspace } from "@/components/operational/kitchen-workspace"
import { canAccessOperationalWorkspace, getDefaultOperationalPath } from "@/lib/operational-home"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getTenantAwareAdminData } from "@/lib/tenant-admin-data"

export const dynamic = "force-dynamic"

export default async function KitchenPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")

  if (!canAccessOperationalWorkspace("kitchen", session.role, session.operationalPermissions)) {
    redirect(getDefaultOperationalPath(session.role, session.operationalPermissions))
  }

  const data = await getTenantAwareAdminData(session, session.operationalPermissions)

  return (
    <KitchenWorkspace
      organizationName={session.organizationName}
      initialOrders={data.orders}
      settings={data.settings}
    />
  )
}
