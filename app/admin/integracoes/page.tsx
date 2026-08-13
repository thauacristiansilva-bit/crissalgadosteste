import { redirect } from "next/navigation"
import { IntegrationsDashboard } from "@/components/admin/integrations-dashboard"
import { canAccessIntegrations } from "@/lib/integrations-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export default async function IntegrationsPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")
  if (!canAccessIntegrations(session)) redirect("/admin")
  return <IntegrationsDashboard currentOrganizationName={session.organizationName} />
}
