import type { AdminSession } from "@/lib/auth"
import {
  getTenantCategories,
  getTenantProducts,
  isTenantCatalogReady,
} from "@/lib/catalog-db"
import { getAdminData } from "@/lib/db"
import {
  getTenantOrders,
  isTenantOrdersReady,
  summarizeOrders,
} from "@/lib/order-db"
import { membershipExists } from "@/lib/tenant-context"

export async function getTenantAwareAdminData(session: AdminSession) {
  const data = await getAdminData()

  if (session.mode !== "tenant") return data

  const activeMembership = await membershipExists(
    session.userId,
    session.organizationId,
  )

  if (!activeMembership) return data

  try {
    if (await isTenantCatalogReady(session.organizationId)) {
      const [products, categories] = await Promise.all([
        getTenantProducts(session.organizationId, {
          includeInactive: true,
        }),
        getTenantCategories(session.organizationId, {
          includeInactive: true,
        }),
      ])

      data.products = products
      data.categories = categories
    }
  } catch (error) {
    console.error(
      "[SaborFlow] Catálogo PostgreSQL indisponível; usando legado:",
      error instanceof Error ? error.message : error,
    )
  }

  try {
    if (await isTenantOrdersReady(session.organizationId)) {
      const orders = await getTenantOrders(session.organizationId)
      data.orders = orders
      data.summary = summarizeOrders(orders)
    }
  } catch (error) {
    console.error(
      "[SaborFlow] Pedidos PostgreSQL indisponíveis; usando legado:",
      error instanceof Error ? error.message : error,
    )
  }

  return data
}
