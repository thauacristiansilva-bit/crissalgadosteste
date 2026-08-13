import { redirect } from "next/navigation"
import { ReportsDashboard } from "@/components/admin/reports-dashboard"
import { canAccessManagementReports } from "@/lib/reports-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")
  if (!canAccessManagementReports(session)) redirect("/admin")

  return <ReportsDashboard currentOrganizationName={session.organizationName} />
}
