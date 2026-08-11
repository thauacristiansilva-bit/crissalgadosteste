import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import {
  getCurrentDeploymentOrganizationId,
} from "@/lib/catalog-db"
import {
  getTenantOrderByReference,
  isTenantOrdersReady,
} from "@/lib/order-db"
import {
  assertDeliveryZoneValid,
  nextDeliveryZoneColor,
} from "@/lib/delivery-zone-geometry"
import type {
  CashSession,
  Coupon,
  Courier,
  DeliveryZone,
  Feedback,
  FinancialEntry,
} from "@/lib/types"

type CouponRow = {
  id: number
  code: string
  description: string
  type: Coupon["type"]
  value: string | number
  minimum_order: string | number
  active: boolean
  expires_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

type FeedbackRow = {
  id: number
  order_id: number
  order_reference: string
  customer_name: string
  rating: number
  reaction: string
  comment: string
  created_at: Date | string
}

type CashRow = {
  id: number
  opened_at: Date | string
  opened_by: string
  opening_amount: string | number
  closed_at: Date | string | null
  closing_amount: string | number | null
  notes: string
}

type FinancialRow = {
  id: number
  type: FinancialEntry["type"]
  category: string
  description: string
  amount: string | number
  created_at: Date | string
}

type DeliveryZoneRow = {
  id: number
  name: string
  color: string
  fee: string | number
  active: boolean
  shape: DeliveryZone["shape"]
  points: DeliveryZone["points"]
  center_lat: number
  center_lng: number
  radius_meters: number
  created_at: Date | string
  updated_at: Date | string
}

type CourierRow = {
  id: number
  name: string
  phone: string
  vehicle: string
  active: boolean
  created_at: Date | string
  updated_at: Date | string
}

function iso(value: Date | string) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString()
}

function mapCoupon(row: CouponRow): Coupon {
  return {
    id: Number(row.id),
    code: row.code,
    description: row.description || "",
    type: row.type,
    value: Number(row.value),
    minimumOrder: Number(row.minimum_order),
    active: Boolean(row.active),
    ...(row.expires_at
      ? { expiresAt: iso(row.expires_at) }
      : {}),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function mapFeedback(row: FeedbackRow): Feedback {
  const rating = Math.max(
    1,
    Math.min(5, Number(row.rating)),
  ) as 1 | 2 | 3 | 4 | 5

  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    orderReference: row.order_reference,
    customerName: row.customer_name,
    rating,
    reaction: row.reaction,
    comment: row.comment || "",
    createdAt: iso(row.created_at),
  }
}

function mapCash(row: CashRow): CashSession {
  return {
    id: Number(row.id),
    openedAt: iso(row.opened_at),
    openedBy: row.opened_by,
    openingAmount: Number(row.opening_amount),
    ...(row.closed_at
      ? { closedAt: iso(row.closed_at) }
      : {}),
    ...(row.closing_amount !== null
      ? { closingAmount: Number(row.closing_amount) }
      : {}),
    ...(row.notes ? { notes: row.notes } : {}),
  }
}

function mapFinancial(row: FinancialRow): FinancialEntry {
  return {
    id: Number(row.id),
    type: row.type,
    category: row.category,
    description: row.description || "",
    amount: Number(row.amount),
    createdAt: iso(row.created_at),
  }
}

function mapDeliveryZone(row: DeliveryZoneRow): DeliveryZone {
  const points = Array.isArray(row.points)
    ? row.points
        .map((point) => ({
          lat: Number(point.lat),
          lng: Number(point.lng),
        }))
        .filter(
          (point) =>
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lng),
        )
    : []

  return {
    id: Number(row.id),
    name: row.name,
    color: row.color,
    fee: Number(row.fee),
    active: Boolean(row.active),
    shape:
      row.shape === "polygon" && points.length >= 3
        ? "polygon"
        : "circle",
    points,
    centerLat: Number(row.center_lat),
    centerLng: Number(row.center_lng),
    radiusMeters: Number(row.radius_meters),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function mapCourier(row: CourierRow): Courier {
  return {
    id: Number(row.id),
    name: row.name,
    phone: row.phone,
    vehicle: row.vehicle || "",
    active: Boolean(row.active),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

async function lockOperations(
  client: PoolClient,
  organizationId: string,
) {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`saborflow-operations:${organizationId}`],
  )
}

async function nextId(
  client: PoolClient,
  table:
    | "sf_coupons"
    | "sf_feedbacks"
    | "sf_cash_sessions"
    | "sf_financial_entries"
    | "sf_delivery_zones"
    | "sf_couriers",
  organizationId: string,
) {
  const result = await client.query<{ next_id: number }>(
    `
      SELECT COALESCE(MAX(id), 0)::int + 1 AS next_id
      FROM ${table}
      WHERE organization_id = $1
    `,
    [organizationId],
  )

  return Number(result.rows[0]?.next_id || 1)
}

async function refreshState(organizationId: string) {
  await getPostgresPool().query(
    `
      UPDATE sf_operations_state
      SET
        coupons_count = (
          SELECT COUNT(*)::int
          FROM sf_coupons
          WHERE organization_id = $1
        ),
        feedbacks_count = (
          SELECT COUNT(*)::int
          FROM sf_feedbacks
          WHERE organization_id = $1
        ),
        cash_sessions_count = (
          SELECT COUNT(*)::int
          FROM sf_cash_sessions
          WHERE organization_id = $1
        ),
        financial_entries_count = (
          SELECT COUNT(*)::int
          FROM sf_financial_entries
          WHERE organization_id = $1
        ),
        delivery_zones_count = (
          SELECT COUNT(*)::int
          FROM sf_delivery_zones
          WHERE organization_id = $1
        ),
        couriers_count = (
          SELECT COUNT(*)::int
          FROM sf_couriers
          WHERE organization_id = $1
        ),
        updated_at = now()
      WHERE organization_id = $1
        AND ready = true
    `,
    [organizationId],
  )
}

export async function isTenantOperationsReady(
  organizationId: string,
) {
  try {
    const result = await getPostgresPool().query<{
      ready: boolean
    }>(
      `
        SELECT ready
        FROM sf_operations_state
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organizationId],
    )

    return Boolean(result.rows[0]?.ready)
  } catch (error) {
    const pgError = error as { code?: string }
    if (pgError?.code === "42P01") return false
    throw error
  }
}


// ---------------- Coupons ----------------

export async function getTenantCoupons(
  organizationId: string,
  options?: { includeInactive?: boolean },
) {
  const result = await getPostgresPool().query<CouponRow>(
    `
      SELECT
        id,
        code,
        description,
        type,
        value,
        minimum_order,
        active,
        expires_at,
        created_at,
        updated_at
      FROM sf_coupons
      WHERE organization_id = $1
        ${options?.includeInactive ? "" : "AND active = true"}
      ORDER BY code ASC, id ASC
    `,
    [organizationId],
  )

  return result.rows.map(mapCoupon)
}

export async function validateTenantCoupon(
  organizationId: string,
  code: string,
  subtotal: number,
) {
  const result = await getPostgresPool().query<CouponRow>(
    `
      SELECT
        id,
        code,
        description,
        type,
        value,
        minimum_order,
        active,
        expires_at,
        created_at,
        updated_at
      FROM sf_coupons
      WHERE organization_id = $1
        AND lower(code) = lower($2)
        AND active = true
      LIMIT 1
    `,
    [organizationId, code.trim()],
  )

  const row = result.rows[0]
  if (!row) throw new Error("Cupom inválido ou inativo.")

  const coupon = mapCoupon(row)

  if (
    coupon.expiresAt &&
    new Date(coupon.expiresAt).getTime() < Date.now()
  ) {
    throw new Error("Este cupom expirou.")
  }

  if (subtotal < coupon.minimumOrder) {
    throw new Error(
      `Este cupom exige pedido mínimo de R$ ${coupon.minimumOrder
        .toFixed(2)
        .replace(".", ",")}.`,
    )
  }

  const discount =
    coupon.type === "percent"
      ? (subtotal * Math.min(100, coupon.value)) / 100
      : Math.min(subtotal, coupon.value)

  return {
    discount: Number(discount.toFixed(2)),
    coupon,
  }
}

export async function createTenantCoupon(
  organizationId: string,
  input: Omit<Coupon, "id" | "createdAt" | "updatedAt">,
) {
  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await lockOperations(client, organizationId)

    const code = input.code.trim().toUpperCase()
    if (!code) throw new Error("Informe o código do cupom.")

    const duplicate = await client.query(
      `
        SELECT 1
        FROM sf_coupons
        WHERE organization_id = $1
          AND lower(code) = lower($2)
        LIMIT 1
      `,
      [organizationId, code],
    )

    if (duplicate.rowCount) {
      throw new Error("Esse cupom já existe.")
    }

    const id = await nextId(
      client,
      "sf_coupons",
      organizationId,
    )

    const result = await client.query<CouponRow>(
      `
        INSERT INTO sf_coupons (
          organization_id,
          id,
          code,
          description,
          type,
          value,
          minimum_order,
          active,
          expires_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, now(), now()
        )
        RETURNING
          id,
          code,
          description,
          type,
          value,
          minimum_order,
          active,
          expires_at,
          created_at,
          updated_at
      `,
      [
        organizationId,
        id,
        code,
        input.description.trim(),
        input.type,
        Math.max(0, Number(input.value)),
        Math.max(0, Number(input.minimumOrder)),
        Boolean(input.active),
        input.expiresAt || null,
      ],
    )

    await client.query("COMMIT")
    await refreshState(organizationId)

    return mapCoupon(result.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    const pgError = error as { code?: string }

    if (pgError?.code === "23505") {
      throw new Error("Esse cupom já existe.")
    }

    throw error
  } finally {
    client.release()
  }
}

export async function updateTenantCoupon(
  organizationId: string,
  id: number,
  patch: Partial<Coupon>,
) {
  const coupons = await getTenantCoupons(
    organizationId,
    { includeInactive: true },
  )
  const current = coupons.find((item) => item.id === id)
  if (!current) return null

  const next: Coupon = {
    ...current,
    ...patch,
    id: current.id,
    code:
      patch.code !== undefined
        ? patch.code.trim().toUpperCase()
        : current.code,
    value:
      patch.value !== undefined
        ? Math.max(0, Number(patch.value))
        : current.value,
    minimumOrder:
      patch.minimumOrder !== undefined
        ? Math.max(0, Number(patch.minimumOrder))
        : current.minimumOrder,
    updatedAt: new Date().toISOString(),
  }

  if (!next.code) {
    throw new Error("Informe o código do cupom.")
  }

  const result = await getPostgresPool().query<CouponRow>(
    `
      UPDATE sf_coupons
      SET
        code = $3,
        description = $4,
        type = $5,
        value = $6,
        minimum_order = $7,
        active = $8,
        expires_at = $9,
        updated_at = now()
      WHERE organization_id = $1
        AND id = $2
      RETURNING
        id,
        code,
        description,
        type,
        value,
        minimum_order,
        active,
        expires_at,
        created_at,
        updated_at
    `,
    [
      organizationId,
      id,
      next.code,
      next.description,
      next.type,
      next.value,
      next.minimumOrder,
      next.active,
      next.expiresAt || null,
    ],
  )

  return result.rows[0] ? mapCoupon(result.rows[0]) : null
}


// ---------------- Feedback ----------------

export async function getTenantFeedbacks(
  organizationId: string,
) {
  const result = await getPostgresPool().query<FeedbackRow>(
    `
      SELECT
        id,
        order_id,
        order_reference,
        customer_name,
        rating,
        reaction,
        comment,
        created_at
      FROM sf_feedbacks
      WHERE organization_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [organizationId],
  )

  return result.rows.map(mapFeedback)
}

export async function createTenantFeedback(
  organizationId: string,
  input: {
    orderReference: string
    rating: number
    comment?: string
  },
) {
  if (!(await isTenantOrdersReady(organizationId))) {
    throw new Error("Pedidos multiempresa ainda não estão disponíveis.")
  }

  const order = await getTenantOrderByReference(
    organizationId,
    input.orderReference,
  )

  if (!order) {
    throw new Error("Pedido não encontrado.")
  }

  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await lockOperations(client, organizationId)

    const duplicate = await client.query(
      `
        SELECT 1
        FROM sf_feedbacks
        WHERE organization_id = $1
          AND order_id = $2
        LIMIT 1
      `,
      [organizationId, order.id],
    )

    if (duplicate.rowCount) {
      throw new Error("Este pedido já foi avaliado.")
    }

    const id = await nextId(
      client,
      "sf_feedbacks",
      organizationId,
    )

    const rating = Math.max(
      1,
      Math.min(5, Math.floor(Number(input.rating))),
    ) as 1 | 2 | 3 | 4 | 5

    const reactions = ["😞", "🙁", "😐", "🙂", "😍"]

    const result = await client.query<FeedbackRow>(
      `
        INSERT INTO sf_feedbacks (
          organization_id,
          id,
          order_id,
          order_reference,
          customer_name,
          rating,
          reaction,
          comment,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, now()
        )
        RETURNING
          id,
          order_id,
          order_reference,
          customer_name,
          rating,
          reaction,
          comment,
          created_at
      `,
      [
        organizationId,
        id,
        order.id,
        order.reference,
        order.customer.name,
        rating,
        reactions[rating - 1],
        input.comment?.trim() || "",
      ],
    )

    await client.query("COMMIT")
    await refreshState(organizationId)

    return mapFeedback(result.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    const pgError = error as { code?: string }

    if (pgError?.code === "23505") {
      throw new Error("Este pedido já foi avaliado.")
    }

    throw error
  } finally {
    client.release()
  }
}


// ---------------- Cash ----------------

export async function getTenantCashSessions(
  organizationId: string,
) {
  const result = await getPostgresPool().query<CashRow>(
    `
      SELECT
        id,
        opened_at,
        opened_by,
        opening_amount,
        closed_at,
        closing_amount,
        notes
      FROM sf_cash_sessions
      WHERE organization_id = $1
      ORDER BY opened_at DESC, id DESC
    `,
    [organizationId],
  )

  return result.rows.map(mapCash)
}

export async function openTenantCashSession(
  organizationId: string,
  openedBy: string,
  openingAmount: number,
) {
  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await lockOperations(client, organizationId)

    const open = await client.query(
      `
        SELECT 1
        FROM sf_cash_sessions
        WHERE organization_id = $1
          AND closed_at IS NULL
        LIMIT 1
      `,
      [organizationId],
    )

    if (open.rowCount) {
      throw new Error("Já existe um caixa aberto.")
    }

    const id = await nextId(
      client,
      "sf_cash_sessions",
      organizationId,
    )

    const result = await client.query<CashRow>(
      `
        INSERT INTO sf_cash_sessions (
          organization_id,
          id,
          opened_at,
          opened_by,
          opening_amount,
          notes
        )
        VALUES ($1, $2, now(), $3, $4, '')
        RETURNING
          id,
          opened_at,
          opened_by,
          opening_amount,
          closed_at,
          closing_amount,
          notes
      `,
      [
        organizationId,
        id,
        openedBy.trim(),
        Math.max(0, Number(openingAmount)),
      ],
    )

    await client.query("COMMIT")
    await refreshState(organizationId)

    return mapCash(result.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function closeTenantCashSession(
  organizationId: string,
  id: number,
  closingAmount: number,
  notes?: string,
) {
  const result = await getPostgresPool().query<CashRow>(
    `
      UPDATE sf_cash_sessions
      SET
        closed_at = COALESCE(closed_at, now()),
        closing_amount = $3,
        notes = $4
      WHERE organization_id = $1
        AND id = $2
      RETURNING
        id,
        opened_at,
        opened_by,
        opening_amount,
        closed_at,
        closing_amount,
        notes
    `,
    [
      organizationId,
      id,
      Math.max(0, Number(closingAmount)),
      notes?.trim() || "",
    ],
  )

  return result.rows[0] ? mapCash(result.rows[0]) : null
}


// ---------------- Financial ----------------

export async function getTenantFinancialEntries(
  organizationId: string,
) {
  const result = await getPostgresPool().query<FinancialRow>(
    `
      SELECT
        id,
        type,
        category,
        description,
        amount,
        created_at
      FROM sf_financial_entries
      WHERE organization_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [organizationId],
  )

  return result.rows.map(mapFinancial)
}

export async function createTenantFinancialEntry(
  organizationId: string,
  input: Omit<FinancialEntry, "id" | "createdAt">,
) {
  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await lockOperations(client, organizationId)

    const id = await nextId(
      client,
      "sf_financial_entries",
      organizationId,
    )

    const result = await client.query<FinancialRow>(
      `
        INSERT INTO sf_financial_entries (
          organization_id,
          id,
          type,
          category,
          description,
          amount,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, now())
        RETURNING
          id,
          type,
          category,
          description,
          amount,
          created_at
      `,
      [
        organizationId,
        id,
        input.type,
        input.category.trim() || "Geral",
        input.description.trim(),
        Math.max(0, Number(input.amount)),
      ],
    )

    await client.query("COMMIT")
    await refreshState(organizationId)

    return mapFinancial(result.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}


// ---------------- Delivery Zones ----------------

export async function getTenantDeliveryZones(
  organizationId: string,
  options?: { includeInactive?: boolean },
) {
  const result = await getPostgresPool().query<DeliveryZoneRow>(
    `
      SELECT
        id,
        name,
        color,
        fee,
        active,
        shape,
        points,
        center_lat,
        center_lng,
        radius_meters,
        created_at,
        updated_at
      FROM sf_delivery_zones
      WHERE organization_id = $1
        ${options?.includeInactive ? "" : "AND active = true"}
      ORDER BY fee ASC, id ASC
    `,
    [organizationId],
  )

  return result.rows.map(mapDeliveryZone)
}

export async function createTenantDeliveryZone(
  organizationId: string,
  input: Pick<
    DeliveryZone,
    | "name"
    | "centerLat"
    | "centerLng"
    | "radiusMeters"
    | "fee"
    | "shape"
    | "points"
  >,
) {
  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await lockOperations(client, organizationId)

    const existing = await getTenantDeliveryZones(
      organizationId,
      { includeInactive: true },
    )

    const points = Array.isArray(input.points)
      ? input.points
          .map((point) => ({
            lat: Number(point.lat),
            lng: Number(point.lng),
          }))
          .filter(
            (point) =>
              Number.isFinite(point.lat) &&
              Number.isFinite(point.lng),
          )
      : []

    const shape =
      input.shape === "polygon" && points.length >= 3
        ? "polygon"
        : "circle"

    const id = await nextId(
      client,
      "sf_delivery_zones",
      organizationId,
    )

    const now = new Date().toISOString()

    const zone: DeliveryZone = {
      id,
      name: input.name.trim(),
      color: nextDeliveryZoneColor(existing),
      fee: Math.max(
        0,
        Number(Number(input.fee).toFixed(2)),
      ),
      active: true,
      shape,
      points,
      centerLat: Number(input.centerLat),
      centerLng: Number(input.centerLng),
      radiusMeters: Math.max(
        50,
        Math.round(Number(input.radiusMeters || 1500)),
      ),
      createdAt: now,
      updatedAt: now,
    }

    if (
      !zone.name ||
      !Number.isFinite(zone.centerLat) ||
      !Number.isFinite(zone.centerLng) ||
      !Number.isFinite(zone.fee)
    ) {
      throw new Error(
        "Dados da área de entrega inválidos.",
      )
    }

    if (shape === "polygon" && points.length < 3) {
      throw new Error(
        "Desenhe pelo menos 3 pontos para criar a área personalizada.",
      )
    }

    assertDeliveryZoneValid(zone, existing)

    const result = await client.query<DeliveryZoneRow>(
      `
        INSERT INTO sf_delivery_zones (
          organization_id,
          id,
          name,
          color,
          fee,
          active,
          shape,
          points,
          center_lat,
          center_lng,
          radius_meters,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, true, $6,
          $7::jsonb, $8, $9, $10, now(), now()
        )
        RETURNING
          id,
          name,
          color,
          fee,
          active,
          shape,
          points,
          center_lat,
          center_lng,
          radius_meters,
          created_at,
          updated_at
      `,
      [
        organizationId,
        id,
        zone.name,
        zone.color,
        zone.fee,
        zone.shape,
        JSON.stringify(zone.points),
        zone.centerLat,
        zone.centerLng,
        zone.radiusMeters,
      ],
    )

    await client.query("COMMIT")
    await refreshState(organizationId)

    return mapDeliveryZone(result.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function updateTenantDeliveryZone(
  organizationId: string,
  id: number,
  patch: Partial<
    Pick<
      DeliveryZone,
      | "name"
      | "centerLat"
      | "centerLng"
      | "radiusMeters"
      | "fee"
      | "active"
      | "shape"
      | "points"
    >
  >,
) {
  const zones = await getTenantDeliveryZones(
    organizationId,
    { includeInactive: true },
  )

  const current = zones.find((zone) => zone.id === id)
  if (!current) return null

  const points =
    patch.points !== undefined
      ? patch.points
          .map((point) => ({
            lat: Number(point.lat),
            lng: Number(point.lng),
          }))
          .filter(
            (point) =>
              Number.isFinite(point.lat) &&
              Number.isFinite(point.lng),
          )
      : current.points

  const requestedShape =
    patch.shape !== undefined
      ? patch.shape
      : current.shape

  const shape =
    requestedShape === "polygon" && points.length >= 3
      ? "polygon"
      : "circle"

  const next: DeliveryZone = {
    ...current,
    ...(patch.name !== undefined
      ? { name: patch.name.trim() || current.name }
      : {}),
    ...(patch.centerLat !== undefined
      ? { centerLat: Number(patch.centerLat) }
      : {}),
    ...(patch.centerLng !== undefined
      ? { centerLng: Number(patch.centerLng) }
      : {}),
    ...(patch.radiusMeters !== undefined
      ? {
          radiusMeters: Math.max(
            50,
            Math.round(Number(patch.radiusMeters)),
          ),
        }
      : {}),
    ...(patch.fee !== undefined
      ? {
          fee: Math.max(
            0,
            Number(Number(patch.fee).toFixed(2)),
          ),
        }
      : {}),
    ...(patch.active !== undefined
      ? { active: Boolean(patch.active) }
      : {}),
    shape,
    points,
    updatedAt: new Date().toISOString(),
  }

  if (next.active) {
    assertDeliveryZoneValid(
      next,
      zones.filter((zone) => zone.id !== id),
    )
  }

  const result = await getPostgresPool().query<DeliveryZoneRow>(
    `
      UPDATE sf_delivery_zones
      SET
        name = $3,
        fee = $4,
        active = $5,
        shape = $6,
        points = $7::jsonb,
        center_lat = $8,
        center_lng = $9,
        radius_meters = $10,
        updated_at = now()
      WHERE organization_id = $1
        AND id = $2
      RETURNING
        id,
        name,
        color,
        fee,
        active,
        shape,
        points,
        center_lat,
        center_lng,
        radius_meters,
        created_at,
        updated_at
    `,
    [
      organizationId,
      id,
      next.name,
      next.fee,
      next.active,
      next.shape,
      JSON.stringify(next.points),
      next.centerLat,
      next.centerLng,
      next.radiusMeters,
    ],
  )

  return result.rows[0]
    ? mapDeliveryZone(result.rows[0])
    : null
}

export async function deleteTenantDeliveryZone(
  organizationId: string,
  id: number,
) {
  const result = await getPostgresPool().query(
    `
      DELETE FROM sf_delivery_zones
      WHERE organization_id = $1
        AND id = $2
      RETURNING id
    `,
    [organizationId, id],
  )

  if (result.rowCount) {
    await refreshState(organizationId)
  }

  return Boolean(result.rowCount)
}


// ---------------- Couriers ----------------

export async function getTenantCouriers(
  organizationId: string,
  options?: { includeInactive?: boolean },
) {
  const result = await getPostgresPool().query<CourierRow>(
    `
      SELECT
        id,
        name,
        phone,
        vehicle,
        active,
        created_at,
        updated_at
      FROM sf_couriers
      WHERE organization_id = $1
        ${options?.includeInactive ? "" : "AND active = true"}
      ORDER BY name ASC, id ASC
    `,
    [organizationId],
  )

  return result.rows.map(mapCourier)
}

export async function getTenantCourier(
  organizationId: string,
  id: number,
) {
  const result = await getPostgresPool().query<CourierRow>(
    `
      SELECT
        id,
        name,
        phone,
        vehicle,
        active,
        created_at,
        updated_at
      FROM sf_couriers
      WHERE organization_id = $1
        AND id = $2
      LIMIT 1
    `,
    [organizationId, id],
  )

  return result.rows[0]
    ? mapCourier(result.rows[0])
    : null
}

export async function createTenantCourier(
  organizationId: string,
  input: Pick<Courier, "name" | "phone" | "vehicle">,
) {
  const name = input.name.trim()
  const phone = input.phone.trim()
  const vehicle = input.vehicle.trim()

  if (!name || !phone) {
    throw new Error(
      "Nome e telefone do entregador são obrigatórios.",
    )
  }

  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await lockOperations(client, organizationId)

    const id = await nextId(
      client,
      "sf_couriers",
      organizationId,
    )

    const result = await client.query<CourierRow>(
      `
        INSERT INTO sf_couriers (
          organization_id,
          id,
          name,
          phone,
          vehicle,
          active,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, true, now(), now()
        )
        RETURNING
          id,
          name,
          phone,
          vehicle,
          active,
          created_at,
          updated_at
      `,
      [
        organizationId,
        id,
        name,
        phone,
        vehicle,
      ],
    )

    await client.query("COMMIT")
    await refreshState(organizationId)

    return mapCourier(result.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function updateTenantCourier(
  organizationId: string,
  id: number,
  patch: Partial<
    Pick<Courier, "name" | "phone" | "vehicle" | "active">
  >,
) {
  const current = await getTenantCourier(
    organizationId,
    id,
  )

  if (!current) return null

  const next = {
    ...current,
    ...patch,
    name:
      patch.name !== undefined
        ? patch.name.trim()
        : current.name,
    phone:
      patch.phone !== undefined
        ? patch.phone.trim()
        : current.phone,
    vehicle:
      patch.vehicle !== undefined
        ? patch.vehicle.trim()
        : current.vehicle,
  }

  if (!next.name || !next.phone) {
    throw new Error(
      "Nome e telefone do entregador são obrigatórios.",
    )
  }

  const result = await getPostgresPool().query<CourierRow>(
    `
      UPDATE sf_couriers
      SET
        name = $3,
        phone = $4,
        vehicle = $5,
        active = $6,
        updated_at = now()
      WHERE organization_id = $1
        AND id = $2
      RETURNING
        id,
        name,
        phone,
        vehicle,
        active,
        created_at,
        updated_at
    `,
    [
      organizationId,
      id,
      next.name,
      next.phone,
      next.vehicle,
      next.active,
    ],
  )

  return result.rows[0]
    ? mapCourier(result.rows[0])
    : null
}

export async function deactivateTenantCourier(
  organizationId: string,
  id: number,
) {
  return updateTenantCourier(
    organizationId,
    id,
    { active: false },
  )
}


// ---------------- Deployment/Public helpers ----------------

export async function getCurrentDeploymentDeliveryZones(
  options?: { includeInactive?: boolean },
) {
  const organizationId =
    await getCurrentDeploymentOrganizationId()

  if (!organizationId) return null
  if (!(await isTenantOperationsReady(organizationId))) {
    return null
  }

  return getTenantDeliveryZones(
    organizationId,
    options,
  )
}

export async function validateCurrentDeploymentCoupon(
  code: string,
  subtotal: number,
) {
  const organizationId =
    await getCurrentDeploymentOrganizationId()

  if (!organizationId) return null
  if (!(await isTenantOperationsReady(organizationId))) {
    return null
  }

  return validateTenantCoupon(
    organizationId,
    code,
    subtotal,
  )
}

export async function getTenantOperationsData(
  organizationId: string,
) {
  const [
    coupons,
    feedbacks,
    cashSessions,
    financialEntries,
    deliveryZones,
    couriers,
  ] = await Promise.all([
    getTenantCoupons(organizationId, {
      includeInactive: true,
    }),
    getTenantFeedbacks(organizationId),
    getTenantCashSessions(organizationId),
    getTenantFinancialEntries(organizationId),
    getTenantDeliveryZones(organizationId, {
      includeInactive: true,
    }),
    getTenantCouriers(organizationId, {
      includeInactive: true,
    }),
  ])

  return {
    coupons,
    feedbacks,
    cashSessions,
    financialEntries,
    deliveryZones,
    couriers,
  }
}

export async function getTenantOperationsStats(
  organizationId: string,
) {
  const [state, live] = await Promise.all([
    getPostgresPool().query<{
      ready: boolean
      source: string | null
      coupons_count: number
      feedbacks_count: number
      cash_sessions_count: number
      financial_entries_count: number
      delivery_zones_count: number
      couriers_count: number
      imported_at: Date | string | null
    }>(
      `
        SELECT
          ready,
          source,
          coupons_count,
          feedbacks_count,
          cash_sessions_count,
          financial_entries_count,
          delivery_zones_count,
          couriers_count,
          imported_at
        FROM sf_operations_state
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organizationId],
    ),
    getPostgresPool().query<{
      coupons: number
      feedbacks: number
      cash_sessions: number
      financial_entries: number
      delivery_zones: number
      couriers: number
      financial_signed_total: string | number
    }>(
      `
        SELECT
          (SELECT COUNT(*)::int
             FROM sf_coupons
            WHERE organization_id = $1) AS coupons,
          (SELECT COUNT(*)::int
             FROM sf_feedbacks
            WHERE organization_id = $1) AS feedbacks,
          (SELECT COUNT(*)::int
             FROM sf_cash_sessions
            WHERE organization_id = $1) AS cash_sessions,
          (SELECT COUNT(*)::int
             FROM sf_financial_entries
            WHERE organization_id = $1) AS financial_entries,
          (SELECT COUNT(*)::int
             FROM sf_delivery_zones
            WHERE organization_id = $1) AS delivery_zones,
          (SELECT COUNT(*)::int
             FROM sf_couriers
            WHERE organization_id = $1) AS couriers,
          (SELECT COALESCE(SUM(
             CASE WHEN type = 'income' THEN amount ELSE -amount END
           ), 0)
             FROM sf_financial_entries
            WHERE organization_id = $1) AS financial_signed_total
      `,
      [organizationId],
    ),
  ])

  const row = state.rows[0]
  const counts = live.rows[0]

  return {
    ready: Boolean(row?.ready),
    source: row?.source ?? null,
    importedAt: row?.imported_at
      ? iso(row.imported_at)
      : null,
    coupons: Number(counts?.coupons || 0),
    feedbacks: Number(counts?.feedbacks || 0),
    cashSessions: Number(counts?.cash_sessions || 0),
    financialEntries: Number(
      counts?.financial_entries || 0,
    ),
    deliveryZones: Number(
      counts?.delivery_zones || 0,
    ),
    couriers: Number(counts?.couriers || 0),
    financialSignedTotal: Number(
      counts?.financial_signed_total || 0,
    ),
    imported: {
      coupons: Number(row?.coupons_count || 0),
      feedbacks: Number(row?.feedbacks_count || 0),
      cashSessions: Number(
        row?.cash_sessions_count || 0,
      ),
      financialEntries: Number(
        row?.financial_entries_count || 0,
      ),
      deliveryZones: Number(
        row?.delivery_zones_count || 0,
      ),
      couriers: Number(row?.couriers_count || 0),
    },
  }
}
