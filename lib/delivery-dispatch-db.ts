import { getPostgresPool } from "@/lib/postgres"
import { getTenantOrders } from "@/lib/order-db"
import {
  getTenantCourierForUser,
} from "@/lib/operations-db"
import type { OperationalPermission } from "@/lib/operational-permissions"
import { permissionListHas } from "@/lib/operational-permissions"
import type { OrganizationRole } from "@/lib/tenant-context"
import type { Order } from "@/lib/types"

export type CourierWorkspaceSnapshot = {
  selfMode: boolean
  courier: Awaited<ReturnType<typeof getTenantCourierForUser>>
  orders: Order[]
}

export async function getCourierWorkspaceSnapshot(input: {
  organizationId: string
  userId: string
  role: OrganizationRole
  permissions: readonly OperationalPermission[]
}): Promise<CourierWorkspaceSnapshot> {
  const selfMode = input.role === "courier"
  const courier = selfMode
    ? await getTenantCourierForUser(input.organizationId, input.userId)
    : null

  const orders = await getTenantOrders(input.organizationId)
  const deliveryOrders = orders.filter((order) => order.type === "delivery")

  if (!selfMode) {
    return {
      selfMode: false,
      courier: null,
      orders: permissionListHas(input.permissions, "delivery.manage")
        ? deliveryOrders
        : [],
    }
  }

  if (!courier) {
    return {
      selfMode: true,
      courier: null,
      orders: [],
    }
  }

  return {
    selfMode: true,
    courier,
    orders: deliveryOrders.filter((order) => order.courierId === courier.id),
  }
}

export async function getCourierIdentityForOrderOperation(input: {
  organizationId: string
  userId: string
  role: OrganizationRole
  order: Pick<Order, "type" | "courierId">
}) {
  if (input.role !== "courier") return null

  const courier = await getTenantCourierForUser(
    input.organizationId,
    input.userId,
  )

  if (!courier) {
    throw new Error(
      "Seu login ainda não está vinculado a um perfil de entregador. Peça ao administrador para concluir o vínculo na equipe de entrega.",
    )
  }

  if (input.order.type !== "delivery") {
    throw new Error("O entregador só pode operar pedidos de entrega.")
  }

  if (!input.order.courierId || input.order.courierId !== courier.id) {
    throw new Error(
      "Este pedido não está atribuído ao seu perfil de entregador.",
    )
  }

  return courier
}

export async function getDeliveryDispatchHealth(input: {
  organizationId: string
  userId: string
  role: OrganizationRole
}) {
  const pool = getPostgresPool()

  const schema = await pool.query<{ ready: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sf_couriers'
          AND column_name = 'staff_member_id'
      ) AS ready
    `,
  )

  const schemaReady = Boolean(schema.rows[0]?.ready)

  if (!schemaReady) {
    return {
      schemaReady: false,
      counts: {
        courierProfiles: 0,
        linkedStaffProfiles: 0,
        linkedLogins: 0,
        assignedOpenDeliveries: 0,
        unassignedReadyDeliveries: 0,
      },
      currentCourier: null,
    }
  }

  const counts = await pool.query<{
    courier_profiles: number | string
    linked_staff_profiles: number | string
    linked_logins: number | string
    assigned_open_deliveries: number | string
    unassigned_ready_deliveries: number | string
  }>(
    `
      SELECT
        (SELECT COUNT(*)::int
           FROM sf_couriers
          WHERE organization_id = $1) AS courier_profiles,
        (SELECT COUNT(*)::int
           FROM sf_couriers
          WHERE organization_id = $1
            AND staff_member_id IS NOT NULL) AS linked_staff_profiles,
        (SELECT COUNT(*)::int
           FROM sf_couriers c
           JOIN sf_staff_members s
             ON s.organization_id = c.organization_id
            AND s.id = c.staff_member_id
           JOIN sf_memberships m
             ON m.organization_id = c.organization_id
            AND m.user_id = s.user_id
            AND m.status = 'active'
          WHERE c.organization_id = $1
            AND c.active = true
            AND s.active = true
            AND s.role = 'courier') AS linked_logins,
        (SELECT COUNT(*)::int
           FROM sf_orders
          WHERE organization_id = $1
            AND type = 'delivery'
            AND courier_id IS NOT NULL
            AND status NOT IN ('completed', 'cancelled')) AS assigned_open_deliveries,
        (SELECT COUNT(*)::int
           FROM sf_orders
          WHERE organization_id = $1
            AND type = 'delivery'
            AND courier_id IS NULL
            AND status = 'ready') AS unassigned_ready_deliveries
    `,
    [input.organizationId],
  )

  const row = counts.rows[0]
  const currentCourier = input.role === "courier"
    ? await getTenantCourierForUser(input.organizationId, input.userId)
    : null

  return {
    schemaReady: true,
    counts: {
      courierProfiles: Number(row?.courier_profiles || 0),
      linkedStaffProfiles: Number(row?.linked_staff_profiles || 0),
      linkedLogins: Number(row?.linked_logins || 0),
      assignedOpenDeliveries: Number(row?.assigned_open_deliveries || 0),
      unassignedReadyDeliveries: Number(row?.unassigned_ready_deliveries || 0),
    },
    currentCourier,
  }
}
