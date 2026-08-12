import { redirect } from "next/navigation"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { getAdminEmail, getAdminSession } from "@/lib/auth"
import { getTenantAwareAdminData } from "@/lib/tenant-admin-data"
import { getCommercialOnboardingSnapshot } from "@/lib/commercial-onboarding"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const session = await getAdminSession()
  if (!session) redirect("/login")

  if (session.mode === "tenant" && session.role === "owner") {
    const onboarding = await getCommercialOnboardingSnapshot(session.organizationId)
    if (onboarding && !onboarding.state.completed) redirect("/onboarding")
  }

  return (
    <AdminDashboard
      adminEmail={session.email || getAdminEmail()}
      adminRole={session.mode === "tenant" ? session.role : "owner"}
      initialData={await getTenantAwareAdminData(session)}
    />
  )
}
