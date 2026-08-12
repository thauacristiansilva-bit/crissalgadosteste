import type { AdminSession } from "@/lib/auth"
import {
  getTenantCategories,
  getTenantProducts,
  isCurrentDeploymentOrganization,
  isTenantCatalogReady,
} from "@/lib/catalog-db"
import { getAdminData } from "@/lib/db"
import type { OrganizationRole } from "@/lib/tenant-context"
import { getOrganizationTimeZone } from "@/lib/organization-security-db"
import { canReadCatalog, canReadCustomers, canReadFinance, canReadMarketing, canReadOrders, canReadTeam } from "@/lib/admin-access"
import {
  getTenantOrders,
  isTenantOrdersReady,
  summarizeOrders,
} from "@/lib/order-db"
import {
  membershipExists,
} from "@/lib/tenant-context"
import {
  getTenantCustomers,
  isTenantCustomersReady,
} from "@/lib/customer-db"
import {
  getTenantOperationsData,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import {
  getTenantSettings,
  getTenantStaffMembers,
  isTenantRuntimeReady,
} from "@/lib/organization-db"


type TenantAdminData =
  Awaited<
    ReturnType<typeof getAdminData>
  >

function emptySummary() {
  return {
    totalOrders: 0,
    openOrders: 0,
    readyOrders: 0,
    completedOrders: 0,
    revenue: 0,
    unpaid: 0,
    todayOrders: 0,
    todayRevenue: 0,
  }
}

function restrictTenantDataForRole(
  data: TenantAdminData,
  role: OrganizationRole,
): TenantAdminData {
  const canOrders =
    canReadOrders(role)
  const canCatalog =
    canReadCatalog(role)
  const canCustomers =
    canReadCustomers(role)
  const canFinance =
    canReadFinance(role)
  const canMarketing =
    canReadMarketing(role)
  const canTeam =
    canReadTeam(role)

  return {
    ...data,
    summary:
      canOrders
        ? data.summary
        : emptySummary(),
    orders:
      canOrders
        ? data.orders
        : [],
    products:
      canCatalog
        ? data.products
        : [],
    categories:
      canCatalog
        ? data.categories
        : [],
    customers:
      canCustomers
        ? data.customers
        : [],
    deliveryZones:
      canCatalog ||
      canOrders
        ? data.deliveryZones
        : [],
    couriers:
      canOrders
        ? data.couriers
        : [],
    feedbacks:
      canMarketing
        ? data.feedbacks
        : [],
    coupons:
      canMarketing
        ? data.coupons
        : [],
    cashSessions:
      canFinance
        ? data.cashSessions
        : [],
    financialEntries:
      role === "owner" ||
      role === "admin" ||
      role === "manager"
        ? data.financialEntries
        : [],
    staffMembers:
      canTeam
        ? data.staffMembers
        : [],
  }
}

async function getStrictTenantAdminData(
  organizationId: string,
) {
  const [
    catalogReady,
    ordersReady,
    customersReady,
    operationsReady,
    runtimeReady,
  ] = await Promise.all([
    isTenantCatalogReady(
      organizationId,
    ),
    isTenantOrdersReady(
      organizationId,
    ),
    isTenantCustomersReady(
      organizationId,
    ),
    isTenantOperationsReady(
      organizationId,
    ),
    isTenantRuntimeReady(
      organizationId,
    ),
  ])

  if (
    !catalogReady ||
    !ordersReady ||
    !customersReady ||
    !operationsReady ||
    !runtimeReady
  ) {
    throw new Error(
      "A empresa ativa ainda não concluiu a preparação multiempresa.",
    )
  }

  const [
    products,
    categories,
    orders,
    customers,
    operations,
    settings,
    staffMembers,
    timeZone,
  ] = await Promise.all([
    getTenantProducts(
      organizationId,
      {
        includeInactive: true,
      },
    ),
    getTenantCategories(
      organizationId,
      {
        includeInactive: true,
      },
    ),
    getTenantOrders(
      organizationId,
    ),
    getTenantCustomers(
      organizationId,
    ),
    getTenantOperationsData(
      organizationId,
    ),
    getTenantSettings(
      organizationId,
    ),
    getTenantStaffMembers(
      organizationId,
      {
        includeInactive: true,
      },
    ),
    getOrganizationTimeZone(
      organizationId,
    ).catch(
      () => "America/Sao_Paulo",
    ),
  ])

  if (!settings) {
    throw new Error(
      "Configurações da empresa ativa não foram encontradas.",
    )
  }

  return {
    summary:
      summarizeOrders(
        orders,
        timeZone,
      ),
    orders,
    products,
    categories,
    settings,
    customers,
    deliveryZones:
      operations.deliveryZones,
    couriers:
      operations.couriers,
    feedbacks:
      operations.feedbacks,
    coupons:
      operations.coupons,
    cashSessions:
      operations.cashSessions,
    financialEntries:
      operations.financialEntries,
    staffMembers,
  }
}

export async function getTenantAwareAdminData(
  session: AdminSession,
) {
  if (session.mode !== "tenant") {
    return getAdminData()
  }

  const activeMembership =
    await membershipExists(
      session.userId,
      session.organizationId,
    )

  if (!activeMembership) {
    throw new Error(
      "Acesso à empresa ativa não está mais disponível.",
    )
  }

  const currentDeployment =
    await isCurrentDeploymentOrganization(
      session.organizationId,
    )

  // Para qualquer empresa diferente da original do deployment, o painel é
  // estritamente PostgreSQL. Nunca usamos store.json como fallback, porque
  // isso poderia exibir dados de outra organização.
  if (!currentDeployment) {
    return restrictTenantDataForRole(
      await getStrictTenantAdminData(
        session.organizationId,
      ),
      session.role,
    )
  }

  // A empresa original ainda mantém fallback legado durante a transição.
  const data = await getAdminData()

  try {
    if (
      await isTenantCatalogReady(
        session.organizationId,
      )
    ) {
      const [
        products,
        categories,
      ] = await Promise.all([
        getTenantProducts(
          session.organizationId,
          {
            includeInactive: true,
          },
        ),
        getTenantCategories(
          session.organizationId,
          {
            includeInactive: true,
          },
        ),
      ])

      data.products = products
      data.categories = categories
    }
  } catch (error) {
    console.error(
      "[SaborFlow] Catálogo PostgreSQL indisponível na empresa original; usando legado:",
      error instanceof Error
        ? error.message
        : error,
    )
  }

  try {
    if (
      await isTenantOrdersReady(
        session.organizationId,
      )
    ) {
      const orders =
        await getTenantOrders(
          session.organizationId,
        )

      data.orders = orders
      const timeZone =
        await getOrganizationTimeZone(
          session.organizationId,
        ).catch(
          () => "America/Sao_Paulo",
        )

      data.summary =
        summarizeOrders(
          orders,
          timeZone,
        )
    }
  } catch (error) {
    console.error(
      "[SaborFlow] Pedidos PostgreSQL indisponíveis na empresa original; usando legado:",
      error instanceof Error
        ? error.message
        : error,
    )
  }

  try {
    if (
      await isTenantCustomersReady(
        session.organizationId,
      )
    ) {
      data.customers =
        await getTenantCustomers(
          session.organizationId,
        )
    }
  } catch (error) {
    console.error(
      "[SaborFlow] Clientes PostgreSQL indisponíveis na empresa original; usando legado:",
      error instanceof Error
        ? error.message
        : error,
    )
  }

  try {
    if (
      await isTenantOperationsReady(
        session.organizationId,
      )
    ) {
      const operations =
        await getTenantOperationsData(
          session.organizationId,
        )

      data.coupons =
        operations.coupons
      data.feedbacks =
        operations.feedbacks
      data.cashSessions =
        operations.cashSessions
      data.financialEntries =
        operations.financialEntries
      data.deliveryZones =
        operations.deliveryZones
      data.couriers =
        operations.couriers
    }
  } catch (error) {
    console.error(
      "[SaborFlow] Operação PostgreSQL indisponível na empresa original; usando legado:",
      error instanceof Error
        ? error.message
        : error,
    )
  }

  try {
    if (
      await isTenantRuntimeReady(
        session.organizationId,
      )
    ) {
      const [
        settings,
        staffMembers,
      ] = await Promise.all([
        getTenantSettings(
          session.organizationId,
        ),
        getTenantStaffMembers(
          session.organizationId,
          {
            includeInactive: true,
          },
        ),
      ])

      if (settings) {
        data.settings = settings
      }

      data.staffMembers =
        staffMembers
    }
  } catch (error) {
    console.error(
      "[SaborFlow] Configurações/equipe PostgreSQL indisponíveis na empresa original; usando legado:",
      error instanceof Error
        ? error.message
        : error,
    )
  }

  return restrictTenantDataForRole(
    data,
    session.role,
  )
}
