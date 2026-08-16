import type { AdminSession } from "@/lib/auth"
import {
  getTenantCategories,
  getTenantProducts,
  isTenantCatalogReady,
} from "@/lib/catalog-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import type { OrganizationRole } from "@/lib/tenant-context"
import {
  getRolePermissionPreset,
  permissionListHas,
  type OperationalPermission,
} from "@/lib/operational-permissions"
import { getOrganizationTimeZone } from "@/lib/organization-security-db"
import {
  canReadCatalog,
  canReadCustomers,
  canReadFinance,
  canReadMarketing,
  canReadOrders,
  canReadTeam,
} from "@/lib/admin-access"
import {
  getTenantOrders,
  isTenantOrdersReady,
  summarizeOrders,
} from "@/lib/order-db"
import { membershipExists } from "@/lib/tenant-context"
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

async function getStrictTenantAdminData(organizationId: string) {
  const [
    catalogReady,
    ordersReady,
    customersReady,
    operationsReady,
    runtimeReady,
  ] = await Promise.all([
    isTenantCatalogReady(organizationId),
    isTenantOrdersReady(organizationId),
    isTenantCustomersReady(organizationId),
    isTenantOperationsReady(organizationId),
    isTenantRuntimeReady(organizationId),
  ])

  if (
    !catalogReady ||
    !ordersReady ||
    !customersReady ||
    !operationsReady ||
    !runtimeReady
  ) {
    throw new Error(
      "A empresa ativa ainda não concluiu a preparação PostgreSQL obrigatória da Fase 25.",
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
    getTenantProducts(organizationId, { includeInactive: true }),
    getTenantCategories(organizationId, { includeInactive: true }),
    getTenantOrders(organizationId),
    getTenantCustomers(organizationId),
    getTenantOperationsData(organizationId),
    getTenantSettings(organizationId),
    getTenantStaffMembers(organizationId, { includeInactive: true }),
    getOrganizationTimeZone(organizationId).catch(
      () => "America/Sao_Paulo",
    ),
  ])

  if (!settings) {
    throw new Error("Configurações da empresa ativa não foram encontradas.")
  }

  return {
    summary: summarizeOrders(orders, timeZone),
    orders,
    products,
    categories,
    settings,
    customers,
    deliveryZones: operations.deliveryZones,
    couriers: operations.couriers,
    feedbacks: operations.feedbacks,
    coupons: operations.coupons,
    cashSessions: operations.cashSessions,
    financialEntries: operations.financialEntries,
    staffMembers,
  }
}

type TenantAdminData = Awaited<ReturnType<typeof getStrictTenantAdminData>>

function restrictTenantDataForAccess(
  data: TenantAdminData,
  role: OrganizationRole,
  permissions: readonly OperationalPermission[],
): TenantAdminData {
  const canOrders = canReadOrders(role, permissions)
  const canCatalog = canReadCatalog(role, permissions)
  const canCustomers = canReadCustomers(role, permissions)
  const canFinance = canReadFinance(role, permissions)
  const canMarketing = canReadMarketing(role, permissions)
  const canTeam = canReadTeam(role, permissions)
  const canPdv = permissionListHas(permissions, "pdv.use")
  const canCash = permissionListHas(permissions, "cash.manage")

  return {
    ...data,
    summary: canOrders ? data.summary : emptySummary(),
    orders: canOrders ? data.orders : [],
    // O PDV precisa ler o catálogo de venda, mas isso não concede catalog.manage.
    products: canCatalog || canPdv ? data.products : [],
    categories: canCatalog ? data.categories : [],
    customers: canCustomers ? data.customers : [],
    deliveryZones:
      canCatalog || canOrders || canPdv ? data.deliveryZones : [],
    couriers: canOrders ? data.couriers : [],
    feedbacks: canMarketing ? data.feedbacks : [],
    coupons: canMarketing ? data.coupons : [],
    cashSessions: canFinance || canCash ? data.cashSessions : [],
    financialEntries: canFinance ? data.financialEntries : [],
    staffMembers: canTeam ? data.staffMembers : [],
  }
}

export async function getTenantAwareAdminData(
  session: AdminSession,
  operationalPermissions?: readonly OperationalPermission[],
) {
  if (session.mode !== "tenant") {
    throw new Error(
      "Sessão administrativa legada foi desativada. Entre novamente.",
    )
  }

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () => {
      const activeMembership = await membershipExists(
        session.userId,
        session.organizationId,
      )

      if (!activeMembership) {
        throw new Error("Acesso à empresa ativa não está mais disponível.")
      }

      return restrictTenantDataForAccess(
        await getStrictTenantAdminData(session.organizationId),
        session.role,
        operationalPermissions ?? getRolePermissionPreset(session.role),
      )
    },
    "tenant-session",
  )
}
