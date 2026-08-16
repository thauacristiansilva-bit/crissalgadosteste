import { getPostgresPool } from "@/lib/postgres"
import { getTenantCourierForUser } from "@/lib/operations-db"
import { getTenantSettings } from "@/lib/organization-db"
import type { Order } from "@/lib/types"

export type PublicDeliveryTrackingState =
  | "disabled"
  | "preparing"
  | "waiting-courier"
  | "waiting-departure"
  | "other-delivery"
  | "active"
  | "active-location-pending"
  | "completed"
  | "cancelled"

export type PublicDeliveryTracking = {
  enabled: boolean
  state: PublicDeliveryTrackingState
  message: string
  courierName?: string
  location?: {
    latitude: number
    longitude: number
    accuracyMeters: number | null
    updatedAt: string
  }
}

type CourierRuntimeRow = {
  id: number
  name: string
  active: boolean
  active_order_id: number | null
  current_latitude: string | number | null
  current_longitude: string | number | null
  location_accuracy_meters: string | number | null
  location_updated_at: Date | string | null
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function validLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

function validLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180
}

export async function claimCourierActiveOrder(input: {
  organizationId: string
  courierId: number
  orderId: number
}) {
  const result = await getPostgresPool().query<{ active_order_id: number }>(
    `
      UPDATE sf_couriers
      SET
        active_order_id = $3,
        updated_at = now()
      WHERE organization_id = $1
        AND id = $2
        AND active = true
        AND (active_order_id IS NULL OR active_order_id = $3)
      RETURNING active_order_id
    `,
    [input.organizationId, input.courierId, input.orderId],
  )

  if (result.rows[0]) return Number(result.rows[0].active_order_id)

  const current = await getPostgresPool().query<{ active_order_id: number | null }>(
    `
      SELECT active_order_id
      FROM sf_couriers
      WHERE organization_id = $1
        AND id = $2
      LIMIT 1
    `,
    [input.organizationId, input.courierId],
  )

  if (!current.rows[0]) {
    throw new Error("Entregador não encontrado para esta empresa.")
  }

  throw new Error(
    "Este entregador já está em outra entrega. Finalize a entrega ativa antes de iniciar a próxima.",
  )
}

export async function releaseCourierActiveOrder(input: {
  organizationId: string
  courierId: number
  orderId: number
}) {
  await getPostgresPool().query(
    `
      UPDATE sf_couriers
      SET
        active_order_id = NULL,
        current_latitude = NULL,
        current_longitude = NULL,
        location_accuracy_meters = NULL,
        location_updated_at = NULL,
        updated_at = now()
      WHERE organization_id = $1
        AND id = $2
        AND active_order_id = $3
    `,
    [input.organizationId, input.courierId, input.orderId],
  )
}

export async function recordCourierLiveLocation(input: {
  organizationId: string
  userId: string
  latitude: number
  longitude: number
  accuracyMeters?: number | null
}) {
  if (!validLatitude(input.latitude) || !validLongitude(input.longitude)) {
    throw new Error("Localização inválida.")
  }

  const settings = await getTenantSettings(input.organizationId)
  if (settings?.deliveryTrackingEnabled === false) {
    throw new Error("O rastreamento ao vivo está desativado nas configurações da empresa.")
  }

  const courier = await getTenantCourierForUser(
    input.organizationId,
    input.userId,
  )

  if (!courier || !courier.active) {
    throw new Error("Seu login não está vinculado a um entregador ativo.")
  }

  const accuracy = input.accuracyMeters == null
    ? null
    : Math.max(0, Math.min(10000, Number(input.accuracyMeters)))

  const result = await getPostgresPool().query<{
    active_order_id: number
    location_updated_at: Date | string
  }>(
    `
      UPDATE sf_couriers c
      SET
        current_latitude = $3,
        current_longitude = $4,
        location_accuracy_meters = $5,
        location_updated_at = now(),
        updated_at = now()
      WHERE c.organization_id = $1
        AND c.id = $2
        AND c.active = true
        AND c.active_order_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM sf_orders o
          WHERE o.organization_id = c.organization_id
            AND o.id = c.active_order_id
            AND o.type = 'delivery'
            AND o.status = 'in-route'
            AND o.courier_id = c.id
        )
      RETURNING c.active_order_id, c.location_updated_at
    `,
    [
      input.organizationId,
      courier.id,
      input.latitude,
      input.longitude,
      accuracy,
    ],
  )

  const row = result.rows[0]
  if (!row) {
    throw new Error("Nenhuma entrega ativa está autorizada a compartilhar GPS.")
  }

  return {
    courierId: courier.id,
    activeOrderId: Number(row.active_order_id),
    updatedAt: iso(row.location_updated_at),
  }
}

export async function getPublicDeliveryTracking(input: {
  organizationId: string
  order: Pick<Order, "id" | "type" | "status" | "courierId" | "courierName">
  enabled: boolean
}): Promise<PublicDeliveryTracking> {
  if (input.order.type !== "delivery") {
    return {
      enabled: false,
      state: "disabled",
      message: "Rastreamento disponível somente para delivery.",
    }
  }

  if (!input.enabled) {
    return {
      enabled: false,
      state: "disabled",
      message: "O rastreamento ao vivo está desativado para esta empresa.",
    }
  }

  if (input.order.status === "completed") {
    return {
      enabled: true,
      state: "completed",
      message: "Entrega concluída.",
      ...(input.order.courierName ? { courierName: input.order.courierName } : {}),
    }
  }

  if (input.order.status === "cancelled") {
    return {
      enabled: true,
      state: "cancelled",
      message: "Pedido cancelado.",
    }
  }

  if (!input.order.courierId) {
    return {
      enabled: true,
      state: input.order.status === "ready" ? "waiting-courier" : "preparing",
      message: input.order.status === "ready"
        ? "Pedido pronto. Aguardando definição do entregador."
        : "Seu pedido ainda está sendo preparado para entrega.",
    }
  }

  let result
  try {
    result = await getPostgresPool().query<CourierRuntimeRow>(
      `
        SELECT
          id,
          name,
          active,
          active_order_id,
          current_latitude,
          current_longitude,
          location_accuracy_meters,
          location_updated_at
        FROM sf_couriers
        WHERE organization_id = $1
          AND id = $2
        LIMIT 1
      `,
      [input.organizationId, input.order.courierId],
    )
  } catch (error) {
    // Durante a janela entre deploy e migration, nunca exponha localização.
    // 42703 = undefined_column no PostgreSQL.
    if ((error as { code?: string })?.code === "42703") {
      return {
        enabled: true,
        state: input.order.status === "in-route"
          ? "active-location-pending"
          : "waiting-departure",
        ...(input.order.courierName ? { courierName: input.order.courierName } : {}),
        message: input.order.status === "in-route"
          ? "Seu pedido saiu para entrega. O rastreamento ao vivo está sendo inicializado."
          : "Entregador definido. Aguardando o início da sua rota.",
      }
    }
    throw error
  }

  const courier = result.rows[0]
  if (!courier || !courier.active) {
    return {
      enabled: true,
      state: "waiting-courier",
      message: "Aguardando entregador disponível.",
    }
  }

  const activeOrderId = courier.active_order_id == null
    ? null
    : Number(courier.active_order_id)

  if (activeOrderId !== null && activeOrderId !== input.order.id) {
    return {
      enabled: true,
      state: "other-delivery",
      courierName: courier.name,
      message:
        "O entregador está em outra entrega. A localização só será exibida quando o seu pedido virar a entrega ativa.",
    }
  }

  if (input.order.status !== "in-route") {
    return {
      enabled: true,
      state: "waiting-departure",
      courierName: courier.name,
      message: "Entregador definido. Aguardando o início da sua rota.",
    }
  }

  if (activeOrderId !== input.order.id) {
    return {
      enabled: true,
      state: "active-location-pending",
      courierName: courier.name,
      message: "Seu pedido saiu para entrega. Aguardando ativação do GPS do entregador.",
    }
  }

  const latitude = Number(courier.current_latitude)
  const longitude = Number(courier.current_longitude)
  const updatedAt = courier.location_updated_at
    ? new Date(courier.location_updated_at)
    : null
  const fresh = Boolean(
    updatedAt &&
      Number.isFinite(updatedAt.getTime()) &&
      Date.now() - updatedAt.getTime() <= 120_000,
  )

  if (
    !fresh ||
    !validLatitude(latitude) ||
    !validLongitude(longitude)
  ) {
    return {
      enabled: true,
      state: "active-location-pending",
      courierName: courier.name,
      message: "Seu pedido está na rota. Aguardando uma atualização recente do GPS.",
    }
  }

  return {
    enabled: true,
    state: "active",
    courierName: courier.name,
    message: "Seu pedido é a entrega ativa. Localização do entregador liberada.",
    location: {
      latitude,
      longitude,
      accuracyMeters: courier.location_accuracy_meters == null
        ? null
        : Number(courier.location_accuracy_meters),
      updatedAt: updatedAt!.toISOString(),
    },
  }
}

export async function getDeliveryTrackingHealth(organizationId: string) {
  const pool = getPostgresPool()
  const schema = await pool.query<{ ready: boolean }>(
    `
      SELECT
        COUNT(*)::int = 5 AS ready
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sf_couriers'
        AND column_name = ANY($1::text[])
    `,
    [[
      "active_order_id",
      "current_latitude",
      "current_longitude",
      "location_accuracy_meters",
      "location_updated_at",
    ]],
  )

  const schemaReady = Boolean(schema.rows[0]?.ready)
  if (!schemaReady) {
    return {
      schemaReady: false,
      activeRoutes: 0,
      freshLocations: 0,
      staleLocations: 0,
    }
  }

  const counts = await pool.query<{
    active_routes: number | string
    fresh_locations: number | string
    stale_locations: number | string
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE active_order_id IS NOT NULL)::int AS active_routes,
        COUNT(*) FILTER (
          WHERE active_order_id IS NOT NULL
            AND location_updated_at >= now() - interval '2 minutes'
            AND current_latitude IS NOT NULL
            AND current_longitude IS NOT NULL
        )::int AS fresh_locations,
        COUNT(*) FILTER (
          WHERE active_order_id IS NOT NULL
            AND (
              location_updated_at IS NULL
              OR location_updated_at < now() - interval '2 minutes'
              OR current_latitude IS NULL
              OR current_longitude IS NULL
            )
        )::int AS stale_locations
      FROM sf_couriers
      WHERE organization_id = $1
        AND active = true
    `,
    [organizationId],
  )

  return {
    schemaReady: true,
    activeRoutes: Number(counts.rows[0]?.active_routes || 0),
    freshLocations: Number(counts.rows[0]?.fresh_locations || 0),
    staleLocations: Number(counts.rows[0]?.stale_locations || 0),
  }
}
