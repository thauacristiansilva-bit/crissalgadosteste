import { redirect } from "next/navigation"
import { CrmDashboard } from "@/components/admin/crm-dashboard"
import { canAccessCrm } from "@/lib/crm-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export default async function CrmPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")
  if (!canAccessCrm(session)) redirect("/admin")

  return <CrmDashboard currentOrganizationName={session.organizationName} />
}
