import { redirect } from "next/navigation"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { getAdminEmail, getAdminSession } from "@/lib/auth"
import { getTenantAwareAdminData } from "@/lib/tenant-admin-data"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const session = await getAdminSession()
  if (!session) redirect("/login")

  return (
    <AdminDashboard
      adminEmail={session.email || getAdminEmail()}
      initialData={await getTenantAwareAdminData(session)}
    />
  )
}
