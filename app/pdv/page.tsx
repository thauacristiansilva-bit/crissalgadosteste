import { redirect } from "next/navigation"
import { PdvWorkspace } from "@/components/operational/pdv-workspace"
import { canAccessOperationalWorkspace, getDefaultOperationalPath } from "@/lib/operational-home"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getTenantAwareAdminData } from "@/lib/tenant-admin-data"

export const dynamic = "force-dynamic"

export default async function PdvPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")

  if (!canAccessOperationalWorkspace("pdv", session.role, session.operationalPermissions)) {
    redirect(getDefaultOperationalPath(session.role, session.operationalPermissions))
  }

  const data = await getTenantAwareAdminData(session, session.operationalPermissions)

  return (
    <PdvWorkspace
      organizationName={session.organizationName}
      initialOrders={data.orders}
      products={data.products.filter((product) => product.active)}
      settings={data.settings}
      initialCashSessions={data.cashSessions}
    />
  )
}
