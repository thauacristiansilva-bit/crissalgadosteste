import {
  randomBytes,
} from "node:crypto"
import type { PoolClient } from "pg"
import {
  calculateDeliveryQuote,
} from "@/lib/delivery-pricing"
import {
  getTenantDeliveryZones,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import {
  isStoreOpenNow,
  isWithinBusinessHours,
} from "@/lib/operations"
import {
  IMMEDIATE_DELIVERY_MAX_MINUTES,
  MAX_SCHEDULING_DAYS,
} from "@/lib/order-timing"
import {
  isTenantCatalogReady,
} from "@/lib/catalog-db"
import {
  isTenantOrdersReady,
} from "@/lib/order-db"
import {
  isTenantCustomersReady,
} from "@/lib/customer-db"
import {
  getTenantSettings,
  isTenantRuntimeReady,
} from "@/lib/organization-db"
import {
  getPostgresPool,
} from "@/lib/postgres"
import type {
  DeliveryZone,
  Order,
  StoreSettings,
} from "@/lib/types"

export type TenantCheckoutInput = {
  type: Order["type"]
  paymentMethod: Order["paymentMethod"]
  changeFor?: string
  notes?: string
  customer: Order["customer"]
  items: Array<{
    productId: number
    quantity: number
  }>
  requestedFor?: string
  timing?: "now" | "scheduled"
  couponCode?: string
  channel?: Order["channel"]
  bypassLeadTime?: boolean
  accountId?: number
}

export type TenantCheckoutResult = {
  order: Order
  changedProductIds: number[]
  accountId?: number
}

type LockedProductRow = {
  id: number
  name: string
  price: string | number
  active: boolean
  track_stock: boolean
  stock: number
}

type CouponRow = {
  code: string
  type: "percent" | "fixed"
  value: string | number
  minimum_order: string | number
  active: boolean
  expires_at:
    | Date
    | string
    | null
}

function money(value: number) {
  return Number(
    Number(value).toFixed(2),
  )
}

function combinedItems(
  items: TenantCheckoutInput["items"],
) {
  const map = new Map<
    number,
    number
  >()

  for (const item of items) {
    const productId = Number(
      item.productId,
    )
    const quantity = Math.floor(
      Number(item.quantity),
    )

    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 500
    ) {
      throw new Error(
        "Quantidade de produto inválida.",
      )
    }

    map.set(
      productId,
      (map.get(productId) || 0) +
        quantity,
    )
  }

  return [...map.entries()].map(
    ([productId, quantity]) => ({
      productId,
      quantity,
    }),
  )
}

async function validateCouponWithClient(
  client: PoolClient,
  organizationId: string,
  code: string | undefined,
  subtotal: number,
) {
  if (!code?.trim()) {
    return {
      discount: 0,
      couponCode: undefined as
        | string
        | undefined,
    }
  }

  const result =
    await client.query<CouponRow>(
      `
        SELECT
          code,
          type,
          value,
          minimum_order,
          active,
          expires_at
        FROM sf_coupons
        WHERE organization_id = $1
          AND lower(code) = lower($2)
        LIMIT 1
      `,
      [
        organizationId,
        code.trim(),
      ],
    )

  const coupon = result.rows[0]

  if (
    !coupon ||
    !coupon.active
  ) {
    throw new Error(
      "Cupom inválido ou inativo.",
    )
  }

  if (
    coupon.expires_at &&
    new Date(
      coupon.expires_at,
    ).getTime() < Date.now()
  ) {
    throw new Error(
      "Este cupom expirou.",
    )
  }

  const minimumOrder = Number(
    coupon.minimum_order,
  )

  if (subtotal < minimumOrder) {
    throw new Error(
      `Este cupom exige pedido mínimo de R$ ${minimumOrder
        .toFixed(2)
        .replace(".", ",")}.`,
    )
  }

  const value = Number(
    coupon.value,
  )

  const discount =
    coupon.type === "percent"
      ? (subtotal *
          Math.min(100, value)) /
        100
      : Math.min(subtotal, value)

  return {
    discount: money(discount),
    couponCode: coupon.code,
  }
}

async function ensureCheckoutReady(
  organizationId: string,
) {
  const [
    runtime,
    catalog,
    orders,
    operations,
    customers,
  ] = await Promise.all([
    isTenantRuntimeReady(
      organizationId,
    ),
    isTenantCatalogReady(
      organizationId,
    ),
    isTenantOrdersReady(
      organizationId,
    ),
    isTenantOperationsReady(
      organizationId,
    ),
    isTenantCustomersReady(
      organizationId,
    ),
  ])

  if (
    !runtime ||
    !catalog ||
    !orders ||
    !operations ||
    !customers
  ) {
    throw new Error(
      "Esta empresa ainda não concluiu a preparação do checkout multiempresa.",
    )
  }
}

function pickupAddress(
  settings: StoreSettings,
) {
  const location = [
    settings.address,
    settings.storeDistrict,
    settings.city,
    settings.state,
  ]
    .filter(Boolean)
    .join(", ")

  return location
    ? `Retirada — ${settings.storeName}, ${location}`
    : `Retirada — ${settings.storeName}`
}

async function nextOrderId(
  client: PoolClient,
  organizationId: string,
) {
  const result =
    await client.query<{
      next_id: number
    }>(
      `
        SELECT
          COALESCE(MAX(id), 0)::int + 1
            AS next_id
        FROM sf_orders
        WHERE organization_id = $1
      `,
      [organizationId],
    )

  return Number(
    result.rows[0]?.next_id ||
      1,
  )
}

function orderReference(id: number) {
  const suffix = randomBytes(3)
    .toString("hex")
    .toUpperCase()

  return `SF-${String(id).padStart(
    5,
    "0",
  )}-${suffix}`
}

export async function createTenantCheckoutOrder(
  organizationId: string,
  input: TenantCheckoutInput,
): Promise<TenantCheckoutResult> {
  await ensureCheckoutReady(
    organizationId,
  )

  const settings =
    await getTenantSettings(
      organizationId,
    )

  if (!settings) {
    throw new Error(
      "Configurações da empresa indisponíveis.",
    )
  }

  const requested =
    combinedItems(input.items)

  if (!requested.length) {
    throw new Error(
      "Adicione pelo menos um produto ao pedido.",
    )
  }

  const zones: DeliveryZone[] =
    input.type === "delivery"
      ? await getTenantDeliveryZones(
          organizationId,
        )
      : []

  const client =
    await getPostgresPool().connect()

  try {
    await client.query("BEGIN")

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [
        `saborflow-checkout:${organizationId}`,
      ],
    )

    const nowDate = new Date()
    const now =
      nowDate.toISOString()
    const channel =
      input.channel || "WEB"

    if (
      channel !== "PDV" &&
      !isStoreOpenNow(
        settings,
        nowDate,
      )
    ) {
      throw new Error(
        "Pedidos são aceitos somente durante o horário de funcionamento da empresa.",
      )
    }

    if (
      input.type === "delivery" &&
      !settings.deliveryEnabled
    ) {
      throw new Error(
        "Delivery indisponível no momento.",
      )
    }

    if (
      input.type === "pickup" &&
      !settings.pickupEnabled
    ) {
      throw new Error(
        "Retirada indisponível no momento.",
      )
    }

    const timing =
      input.timing === "now"
        ? "now"
        : "scheduled"

    const immediateLeadMinutes =
      input.type === "delivery"
        ? IMMEDIATE_DELIVERY_MAX_MINUTES
        : settings.pickupLeadMinutes

    const requestedDate =
      timing === "now"
        ? new Date(
            nowDate.getTime() +
              immediateLeadMinutes *
                60_000,
          )
        : new Date(
            String(
              input.requestedFor ||
                "",
            ),
          )

    if (
      Number.isNaN(
        requestedDate.getTime(),
      )
    ) {
      throw new Error(
        "Escolha uma data e um horário válidos para receber o pedido.",
      )
    }

    if (
      timing === "scheduled" &&
      channel !== "PDV" &&
      !isWithinBusinessHours(
        settings,
        requestedDate,
      )
    ) {
      throw new Error(
        "O horário escolhido está fora do expediente da empresa.",
      )
    }

    const leadMinutes =
      input.type === "delivery"
        ? settings.deliveryMinMinutes
        : settings.pickupLeadMinutes

    if (
      timing === "scheduled" &&
      !input.bypassLeadTime &&
      requestedDate.getTime() <
        nowDate.getTime() +
          leadMinutes * 60_000
    ) {
      throw new Error(
        `Escolha um horário com pelo menos ${leadMinutes} minutos de antecedência.`,
      )
    }

    const schedulingDays =
      Math.min(
        MAX_SCHEDULING_DAYS,
        Math.max(
          1,
          Number(
            settings.schedulingDaysAhead ||
              MAX_SCHEDULING_DAYS,
          ),
        ),
      )

    if (
      timing === "scheduled" &&
      channel !== "PDV" &&
      requestedDate.getTime() >
        nowDate.getTime() +
          (schedulingDays + 1) *
            86_400_000
    ) {
      throw new Error(
        `O agendamento pode ser feito com até ${schedulingDays} dias de antecedência.`,
      )
    }

    const productIds =
      requested.map(
        (item) => item.productId,
      )

    const productResult =
      await client.query<LockedProductRow>(
        `
          SELECT
            id,
            name,
            price,
            active,
            track_stock,
            stock
          FROM sf_products
          WHERE organization_id = $1
            AND id = ANY($2::int[])
          FOR UPDATE
        `,
        [
          organizationId,
          productIds,
        ],
      )

    const products = new Map(
      productResult.rows.map(
        (product) => [
          Number(product.id),
          product,
        ],
      ),
    )

    const items: Order["items"] =
      requested.map(
        (requestedItem) => {
          const product =
            products.get(
              requestedItem.productId,
            )

          if (
            !product ||
            !product.active
          ) {
            throw new Error(
              `Produto ${requestedItem.productId} não encontrado ou inativo.`,
            )
          }

          if (
            product.track_stock &&
            Number(product.stock) <
              requestedItem.quantity
          ) {
            throw new Error(
              `${product.name} não possui estoque suficiente.`,
            )
          }

          const unitPrice = Number(
            product.price,
          )

          return {
            productId:
              Number(product.id),
            name: product.name,
            quantity:
              requestedItem.quantity,
            unitPrice,
            subtotal: money(
              unitPrice *
                requestedItem.quantity,
            ),
          }
        },
      )

    const subtotal = money(
      items.reduce(
        (sum, item) =>
          sum + item.subtotal,
        0,
      ),
    )

    if (
      subtotal <
      settings.minimumOrder
    ) {
      throw new Error(
        `Pedido mínimo de R$ ${settings.minimumOrder
          .toFixed(2)
          .replace(".", ",")}.`,
      )
    }

    const coupon =
      await validateCouponWithClient(
        client,
        organizationId,
        input.couponCode,
        subtotal,
      )

    let deliveryFee = 0
    let matchedZone:
      | DeliveryZone
      | null = null

    if (
      input.type === "delivery"
    ) {
      const latitude = Number(
        input.customer.latitude,
      )
      const longitude = Number(
        input.customer.longitude,
      )

      if (
        !Number.isFinite(
          latitude,
        ) ||
        !Number.isFinite(
          longitude,
        )
      ) {
        throw new Error(
          "Defina a localização da entrega para calcular a taxa.",
        )
      }

      const quote =
        await calculateDeliveryQuote(
          settings,
          zones,
          latitude,
          longitude,
          subtotal,
        )

      deliveryFee =
        quote.fee
      matchedZone =
        quote.zone
    }

    const total = money(
      Math.max(
        0,
        subtotal -
          coupon.discount,
      ) + deliveryFee,
    )

    const id =
      await nextOrderId(
        client,
        organizationId,
      )

    const reference =
      orderReference(id)

    const customer: Order["customer"] =
      {
        ...input.customer,
        name:
          input.customer.name
            .trim(),
        phone:
          input.customer.phone
            .trim(),
        address:
          input.type === "pickup"
            ? pickupAddress(
                settings,
              )
            : input.customer.address,
        ...(input.accountId
          ? {
              accountId:
                input.accountId,
            }
          : {}),
      }

    if (
      channel !== "PDV" &&
      (!customer.name ||
        !customer.phone)
    ) {
      throw new Error(
        "Nome e telefone são obrigatórios.",
      )
    }

    if (
      input.type === "delivery" &&
      (!customer.address?.trim() ||
        !customer.number?.trim())
    ) {
      throw new Error(
        "Endereço e número são obrigatórios para delivery.",
      )
    }

    let accountId:
      | number
      | undefined

    if (input.accountId) {
      const account =
        await client.query<{
          id: number
          active: boolean
        }>(
          `
            SELECT id, active
            FROM sf_customer_accounts
            WHERE organization_id = $1
              AND id = $2
            FOR UPDATE
          `,
          [
            organizationId,
            input.accountId,
          ],
        )

      const row =
        account.rows[0]

      if (!row || !row.active) {
        throw new Error(
          "A conta do cliente não está disponível para esta empresa.",
        )
      }

      accountId = Number(row.id)

      if (
        settings.loyaltyEnabled
      ) {
        const points = Math.max(
          0,
          Math.floor(
            total *
              settings.loyaltyPointsPerReal,
          ),
        )

        await client.query(
          `
            UPDATE sf_customer_accounts
            SET
              loyalty_points =
                loyalty_points + $3,
              updated_at = now()
            WHERE organization_id = $1
              AND id = $2
          `,
          [
            organizationId,
            accountId,
            points,
          ],
        )
      }
    }

    const order: Order = {
      id,
      code: `#${id}`,
      reference,
      type: input.type,
      status: "accepted",
      channel,
      subtotal,
      discount:
        coupon.discount,
      ...(coupon.couponCode
        ? {
            couponCode:
              coupon.couponCode,
          }
        : {}),
      deliveryFee,
      total,
      paymentStatus: "unpaid",
      paymentMethod:
        input.paymentMethod,
      ...(input.changeFor?.trim()
        ? {
            changeFor:
              input.changeFor.trim(),
          }
        : {}),
      ...(input.notes?.trim()
        ? {
            notes:
              input.notes.trim(),
          }
        : {}),
      customer,
      ...(matchedZone
        ? {
            deliveryZoneId:
              matchedZone.id,
            deliveryZoneName:
              matchedZone.name,
          }
        : {}),
      requestedFor:
        requestedDate.toISOString(),
      scheduled:
        timing === "scheduled",
      items,
      createdAt: now,
      updatedAt: now,
    }

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
          delivery_zone_id,
          delivery_zone_name,
          requested_for,
          scheduled,
          source,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17::jsonb, $18, $19, $20,
          $21, $22, $23, $24
        )
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
        JSON.stringify(
          order.customer,
        ),
        order.deliveryZoneId ??
          null,
        order.deliveryZoneName ||
          null,
        order.requestedFor,
        order.scheduled,
        channel === "PDV"
          ? "tenant-pdv"
          : "tenant-checkout",
        order.createdAt,
        order.updatedAt,
      ],
    )

    for (
      let index = 0;
      index < items.length;
      index += 1
    ) {
      const item = items[index]

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
          VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8
          )
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

      const product =
        products.get(
          item.productId,
        )

      if (
        product?.track_stock
      ) {
        await client.query(
          `
            UPDATE sf_products
            SET
              stock =
                GREATEST(
                  0,
                  stock - $3
                ),
              updated_at = now()
            WHERE organization_id = $1
              AND id = $2
          `,
          [
            organizationId,
            item.productId,
            item.quantity,
          ],
        )
      }
    }

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
            SELECT COALESCE(
              SUM(total),
              0
            )
            FROM sf_orders
            WHERE organization_id = $1
          ),
          updated_at = now()
        WHERE organization_id = $1
          AND ready = true
      `,
      [organizationId],
    )

    await client.query(
      `
        UPDATE sf_catalog_state
        SET updated_at = now()
        WHERE organization_id = $1
          AND ready = true
      `,
      [organizationId],
    )

    if (accountId) {
      await client.query(
        `
          UPDATE sf_customers_state
          SET updated_at = now()
          WHERE organization_id = $1
            AND ready = true
        `,
        [organizationId],
      )
    }

    await client.query("COMMIT")

    return {
      order,
      changedProductIds:
        items.map(
          (item) =>
            item.productId,
        ),
      ...(accountId
        ? { accountId }
        : {}),
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
