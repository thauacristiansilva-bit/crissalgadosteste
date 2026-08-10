import { redirect } from "next/navigation"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { getAdminEmail, isAdminAuthenticated } from "@/lib/auth"
import { getAdminData } from "@/lib/db"
export const dynamic = "force-dynamic"
export default async function AdminPage() { if (!(await isAdminAuthenticated())) redirect("/login"); return <AdminDashboard adminEmail={getAdminEmail()} initialData={await getAdminData()} /> }
