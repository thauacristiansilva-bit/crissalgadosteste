import { redirect } from "next/navigation"
import { CorporateGroupDashboard } from "@/components/admin/corporate-group-dashboard"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export default async function CorporateGroupPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")

  return <CorporateGroupDashboard currentOrganizationName={session.organizationName} />
}
