import { redirect } from "next/navigation"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { getAdminEmail, isAdminAuthenticated } from "@/lib/auth"
import {
  getCategories,
  getCouriers,
  getCustomers,
  getDashboardSummary,
  getDeliveryZones,
  getOrders,
  getProducts,
  getSettings,
} from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/login")
  const [summary, orders, products, categories, settings, customers, deliveryZones, couriers] = await Promise.all([
    getDashboardSummary(),
    getOrders(),
    getProducts({ includeInactive: true }),
    getCategories({ includeInactive: true }),
    getSettings(),
    getCustomers(),
    getDeliveryZones({ includeInactive: true }),
    getCouriers({ includeInactive: true }),
  ])
  return <AdminDashboard adminEmail={getAdminEmail()} initialData={{ summary, orders, products, categories, settings, customers, deliveryZones, couriers }} />
}
