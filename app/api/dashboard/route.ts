import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
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

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
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
  return NextResponse.json({ summary, orders, products, categories, settings, customers, deliveryZones, couriers })
}
