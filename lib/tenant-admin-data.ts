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
import { getTenantCustomers, isTenantCustomersReady } from "@/lib/customer-db"
import { getTenantOperationsData, isTenantOperationsReady } from "@/lib/operations-db"
import { getTenantSettings, getTenantStaffMembers, isTenantRuntimeReady } from "@/lib/organization-db"

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

  try {
    if (await isTenantCustomersReady(session.organizationId)) {
      data.customers = await getTenantCustomers(
        session.organizationId,
      )
    }
  } catch (error) {
    console.error(
      "[SaborFlow] Clientes PostgreSQL indisponíveis; usando legado:",
      error instanceof Error ? error.message : error,
    )
  }

  try {
    if (await isTenantOperationsReady(session.organizationId)) {
      const operations = await getTenantOperationsData(
        session.organizationId,
      )

      data.coupons = operations.coupons
      data.feedbacks = operations.feedbacks
      data.cashSessions = operations.cashSessions
      data.financialEntries = operations.financialEntries
      data.deliveryZones = operations.deliveryZones
      data.couriers = operations.couriers
    }
  } catch (error) {
    console.error(
      "[SaborFlow] Operação PostgreSQL indisponível; usando legado:",
      error instanceof Error ? error.message : error,
    )
  }

  try {
    if (await isTenantRuntimeReady(session.organizationId)) {
      const [settings, staffMembers] = await Promise.all([
        getTenantSettings(session.organizationId),
        getTenantStaffMembers(
          session.organizationId,
          { includeInactive: true },
        ),
      ])

      if (settings) {
        data.settings = settings
      }

      data.staffMembers = staffMembers
    }
  } catch (error) {
    console.error(
      "[SaborFlow] Configurações/equipe PostgreSQL indisponíveis; usando legado:",
      error instanceof Error ? error.message : error,
    )
  }

  return data
}
