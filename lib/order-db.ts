import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import { getCurrentDeploymentOrganizationId } from "@/lib/catalog-db"
import type {
  DashboardSummary,
  Order,
  OrderStatus,
  PaymentStatus,
} from "@/lib/types"

type OrderRow = {
  id: number
  code: string
  reference: string
  type: Order["type"]
  status: Order["status"]
  channel: Order["channel"]
  subtotal: string | number
  discount: string | number
  coupon_code: string | null
  delivery_fee: string | number
  total: string | number
  payment_status: Order["paymentStatus"]
  payment_method: Order["paymentMethod"]
  change_for: string | null
  notes: string | null
  customer: Order["customer"]
  courier_id: number | null
  courier_name: string | null
  delivery_zone_id: number | null
  delivery_zone_name: string | null
  requested_for: Date | string
  scheduled: boolean
  printed_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

type OrderItemRow = {
  order_id: number
  line_no: number
  product_id: number
  name: string
  quantity: number
  unit_price: string | number
  subtotal: string | number
}

function iso(value: Date | string) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString()
}

function mapOrder(row: OrderRow, itemRows: OrderItemRow[]): Order {
  return {
    id: Number(row.id),
    code: row.code,
    reference: row.reference,
    type: row.type,
    status: row.status,
    channel: row.channel,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    ...(row.coupon_code ? { couponCode: row.coupon_code } : {}),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    ...(row.change_for ? { changeFor: row.change_for } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    customer: row.customer,
    ...(row.courier_id !== null ? { courierId: Number(row.courier_id) } : {}),
    ...(row.courier_name ? { courierName: row.courier_name } : {}),
    ...(row.delivery_zone_id !== null
      ? { deliveryZoneId: Number(row.delivery_zone_id) }
      : {}),
    ...(row.delivery_zone_name
      ? { deliveryZoneName: row.delivery_zone_name }
      : {}),
    requestedFor: iso(row.requested_for),
    scheduled: Boolean(row.scheduled),
    ...(row.printed_at ? { printedAt: iso(row.printed_at) } : {}),
    items: itemRows
      .sort((a, b) => a.line_no - b.line_no)
      .map((item) => ({
        productId: Number(item.product_id),
        name: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        subtotal: Number(item.subtotal),
      })),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

const orderSelect = `
  SELECT
    id,
    code,
    reference,
    type,
    status,
    channel,
    subtotal,
    discount,
    coupon_code,
    delivery_fee,
    total,
    payment_status,
    payment_method,
    change_for,
    notes,
    customer,
    courier_id,
    courier_name,
    delivery_zone_id,
    delivery_zone_name,
    requested_for,
    scheduled,
    printed_at,
    created_at,
    updated_at
  FROM sf_orders
`

async function getItemsForOrderIds(
  organizationId: string,
  ids: number[],
) {
  if (!ids.length) return new Map<number, OrderItemRow[]>()

  const result = await getPostgresPool().query<OrderItemRow>(
    `
      SELECT
        order_id,
        line_no,
        product_id,
        name,
        quantity,
        unit_price,
        subtotal
      FROM sf_order_items
      WHERE organization_id = $1
        AND order_id = ANY($2::int[])
      ORDER BY order_id ASC, line_no ASC
    `,
    [organizationId, ids],
  )

  const map = new Map<number, OrderItemRow[]>()

  for (const item of result.rows) {
    const list = map.get(Number(item.order_id)) || []
    list.push(item)
    map.set(Number(item.order_id), list)
  }

  return map
}

export async function isTenantOrdersReady(organizationId: string) {
  try {
    const result = await getPostgresPool().query<{ ready: boolean }>(
      `
        SELECT ready
        FROM sf_orders_state
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

export async function getTenantOrders(
  organizationId: string,
): Promise<Order[]> {
  const result = await getPostgresPool().query<OrderRow>(
    `
      ${orderSelect}
      WHERE organization_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [organizationId],
  )

  const items = await getItemsForOrderIds(
    organizationId,
    result.rows.map((row) => Number(row.id)),
  )

  return result.rows.map((row) =>
    mapOrder(row, items.get(Number(row.id)) || []),
  )
}

export async function getTenantOrderById(
  organizationId: string,
  id: number,
): Promise<Order | null> {
  const result = await getPostgresPool().query<OrderRow>(
    `
      ${orderSelect}
      WHERE organization_id = $1
        AND id = $2
      LIMIT 1
    `,
    [organizationId, id],
  )

  const row = result.rows[0]
  if (!row) return null

  const items = await getItemsForOrderIds(organizationId, [id])
  return mapOrder(row, items.get(id) || [])
}

export async function getTenantOrderByReference(
  organizationId: string,
  reference: string,
): Promise<Order | null> {
  const result = await getPostgresPool().query<OrderRow>(
    `
      ${orderSelect}
      WHERE organization_id = $1
        AND lower(reference) = lower($2)
      LIMIT 1
    `,
    [organizationId, reference.trim()],
  )

  const row = result.rows[0]
  if (!row) return null

  const id = Number(row.id)
  const items = await getItemsForOrderIds(organizationId, [id])
  return mapOrder(row, items.get(id) || [])
}

async function writeOrder(
  client: PoolClient,
  organizationId: string,
  order: Order,
  source: string,
) {
  await client.query(
    `
      INSERT INTO sf_orders (
        organization_id,
        id,
        code,
        reference,
        type,
        status,
        channel,
        subtotal,
        discount,
        coupon_code,
        delivery_fee,
        total,
        payment_status,
        payment_method,
        change_for,
        notes,
        customer,
        courier_id,
        courier_name,
        delivery_zone_id,
        delivery_zone_name,
        requested_for,
        scheduled,
        printed_at,
        source,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17::jsonb, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27
      )
      ON CONFLICT (organization_id, id)
      DO UPDATE SET
        code = EXCLUDED.code,
        reference = EXCLUDED.reference,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        channel = EXCLUDED.channel,
        subtotal = EXCLUDED.subtotal,
        discount = EXCLUDED.discount,
        coupon_code = EXCLUDED.coupon_code,
        delivery_fee = EXCLUDED.delivery_fee,
        total = EXCLUDED.total,
        payment_status = EXCLUDED.payment_status,
        payment_method = EXCLUDED.payment_method,
        change_for = EXCLUDED.change_for,
        notes = EXCLUDED.notes,
        customer = EXCLUDED.customer,
        courier_id = EXCLUDED.courier_id,
        courier_name = EXCLUDED.courier_name,
        delivery_zone_id = EXCLUDED.delivery_zone_id,
        delivery_zone_name = EXCLUDED.delivery_zone_name,
        requested_for = EXCLUDED.requested_for,
        scheduled = EXCLUDED.scheduled,
        printed_at = EXCLUDED.printed_at,
        source = EXCLUDED.source,
        updated_at = EXCLUDED.updated_at
    `,
    [
      organizationId,
      order.id,
      order.code,
      order.reference,
      order.type,
      order.status,
      order.channel,
      order.subtotal,
      order.discount,
      order.couponCode || null,
      order.deliveryFee,
      order.total,
      order.paymentStatus,
      order.paymentMethod,
      order.changeFor || null,
      order.notes || null,
      JSON.stringify(order.customer || {}),
      order.courierId ?? null,
      order.courierName || null,
      order.deliveryZoneId ?? null,
      order.deliveryZoneName || null,
      order.requestedFor,
      order.scheduled,
      order.printedAt || null,
      source,
      order.createdAt,
      order.updatedAt,
    ],
  )

  await client.query(
    `
      DELETE FROM sf_order_items
      WHERE organization_id = $1
        AND order_id = $2
    `,
    [organizationId, order.id],
  )

  for (let index = 0; index < order.items.length; index += 1) {
    const item = order.items[index]

    await client.query(
      `
        INSERT INTO sf_order_items (
          organization_id,
          order_id,
          line_no,
          product_id,
          name,
          quantity,
          unit_price,
          subtotal
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        organizationId,
        order.id,
        index + 1,
        item.productId,
        item.name,
        item.quantity,
        item.unitPrice,
        item.subtotal,
      ],
    )
  }
}

export async function upsertTenantOrder(
  organizationId: string,
  order: Order,
  source = "app",
) {
  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`saborflow-orders:${organizationId}`],
    )

    await writeOrder(client, organizationId, order, source)

    await client.query(
      `
        UPDATE sf_orders_state
        SET
          orders_count = (
            SELECT COUNT(*)::int
            FROM sf_orders
            WHERE organization_id = $1
          ),
          items_count = (
            SELECT COUNT(*)::int
            FROM sf_order_items
            WHERE organization_id = $1
          ),
          total_amount = (
            SELECT COALESCE(SUM(total), 0)
            FROM sf_orders
            WHERE organization_id = $1
          ),
          updated_at = now()
        WHERE organization_id = $1
          AND ready = true
      `,
      [organizationId],
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  return order
}

export async function syncCurrentDeploymentOrderFromLegacy(
  order: Order,
  source = "legacy-bridge",
) {
  const organizationId = await getCurrentDeploymentOrganizationId()
  if (!organizationId) return false
  if (!(await isTenantOrdersReady(organizationId))) return false

  await upsertTenantOrder(organizationId, order, source)
  return true
}

export async function updateTenantOrder(
  organizationId: string,
  id: number,
  patch: Partial<
    Pick<
      Order,
      | "status"
      | "paymentStatus"
      | "courierId"
      | "courierName"
      | "printedAt"
    >
  >,
) {
  const current = await getTenantOrderById(organizationId, id)
  if (!current) return null

  const next: Order = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }

  return upsertTenantOrder(organizationId, next, "postgres-admin")
}

export async function getCurrentDeploymentOrderByReference(
  reference: string,
) {
  const organizationId = await getCurrentDeploymentOrganizationId()
  if (!organizationId) return null
  if (!(await isTenantOrdersReady(organizationId))) return null

  return getTenantOrderByReference(organizationId, reference)
}

export async function getCurrentDeploymentOrderById(id: number) {
  const organizationId = await getCurrentDeploymentOrganizationId()
  if (!organizationId) return null
  if (!(await isTenantOrdersReady(organizationId))) return null

  return getTenantOrderById(organizationId, id)
}

export async function getCurrentDeploymentUnprintedOrders() {
  const organizationId = await getCurrentDeploymentOrganizationId()
  if (!organizationId) return null
  if (!(await isTenantOrdersReady(organizationId))) return null

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)

  const result = await getPostgresPool().query<OrderRow>(
    `
      ${orderSelect}
      WHERE organization_id = $1
        AND status NOT IN ('completed', 'cancelled')
        AND printed_at IS NULL
        AND created_at >= $2
      ORDER BY created_at ASC, id ASC
    `,
    [organizationId, cutoff],
  )

  const items = await getItemsForOrderIds(
    organizationId,
    result.rows.map((row) => Number(row.id)),
  )

  return result.rows.map((row) =>
    mapOrder(row, items.get(Number(row.id)) || []),
  )
}

export async function markCurrentDeploymentOrderPrinted(id: number) {
  const organizationId = await getCurrentDeploymentOrganizationId()
  if (!organizationId) return null
  if (!(await isTenantOrdersReady(organizationId))) return null

  return updateTenantOrder(organizationId, id, {
    printedAt: new Date().toISOString(),
  })
}

export function summarizeOrders(orders: Order[]): DashboardSummary {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Fortaleza",
  })

  const valid = orders.filter((order) => order.status !== "cancelled")
  const todayOrders = valid.filter(
    (order) =>
      new Date(order.createdAt).toLocaleDateString("en-CA", {
        timeZone: "America/Fortaleza",
      }) === today,
  )

  return {
    totalOrders: orders.length,
    openOrders: orders.filter((order) =>
      ["pending", "accepted", "preparing", "in-route"].includes(
        order.status,
      ),
    ).length,
    readyOrders: orders.filter((order) => order.status === "ready").length,
    completedOrders: orders.filter(
      (order) => order.status === "completed",
    ).length,
    revenue: Number(
      valid.reduce((sum, order) => sum + order.total, 0).toFixed(2),
    ),
    unpaid: valid.filter((order) => order.paymentStatus === "unpaid").length,
    todayOrders: todayOrders.length,
    todayRevenue: Number(
      todayOrders
        .reduce((sum, order) => sum + order.total, 0)
        .toFixed(2),
    ),
  }
}

export async function getTenantOrdersStats(organizationId: string) {
  const [state, orders, items] = await Promise.all([
    getPostgresPool().query<{
      ready: boolean
      source: string | null
      orders_count: number
      items_count: number
      total_amount: string | number
      imported_at: Date | string | null
    }>(
      `
        SELECT
          ready,
          source,
          orders_count,
          items_count,
          total_amount,
          imported_at
        FROM sf_orders_state
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organizationId],
    ),
    getPostgresPool().query<{
      count: string
      total: string | number
    }>(
      `
        SELECT
          COUNT(*)::text AS count,
          COALESCE(SUM(total), 0) AS total
        FROM sf_orders
        WHERE organization_id = $1
      `,
      [organizationId],
    ),
    getPostgresPool().query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM sf_order_items
        WHERE organization_id = $1
      `,
      [organizationId],
    ),
  ])

  const row = state.rows[0]

  return {
    ready: Boolean(row?.ready),
    source: row?.source ?? null,
    importedAt: row?.imported_at ? iso(row.imported_at) : null,
    orders: Number(orders.rows[0]?.count || 0),
    items: Number(items.rows[0]?.count || 0),
    totalAmount: Number(orders.rows[0]?.total || 0),
    importedOrders: Number(row?.orders_count || 0),
    importedItems: Number(row?.items_count || 0),
    importedTotalAmount: Number(row?.total_amount || 0),
  }
}
