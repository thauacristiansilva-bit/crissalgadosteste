import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import { zonedDateTime, zonedParts } from "@/lib/operations"
import type {
  Product,
  ProductPromotion,
  ProductPromotionPreview,
} from "@/lib/types"

type PromotionRow = {
  id: string
  product_id: number
  product_name: string
  normal_price: string | number
  promotional_price: string | number
  starts_on: Date | string | null
  ends_on: Date | string | null
  days_of_week: number[] | null
  start_time: string
  end_time: string
  recurring_weekly: boolean
  active: boolean
  highlight: boolean
  label: string
  created_at: Date | string
  updated_at: Date | string
}

export type ProductPromotionInput = {
  productId: number
  promotionalPrice: number
  startDate?: string
  endDate?: string
  daysOfWeek: number[]
  startTime: string
  endTime: string
  recurringWeekly: boolean
  active: boolean
  highlight: boolean
  label: string
}

function iso(value: Date | string) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString()
}

function dateOnly(value: Date | string | null) {
  if (!value) return undefined
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  return String(value).slice(0, 10)
}

function timeOnly(value: string) {
  return String(value || "").slice(0, 5)
}

function normalizedDays(value: unknown) {
  const raw = Array.isArray(value) ? value : []
  return [
    ...new Set(
      raw
        .map(Number)
        .filter(
          (day) =>
            Number.isInteger(day) &&
            day >= 0 &&
            day <= 6,
        ),
    ),
  ].sort((a, b) => a - b)
}

function cleanDate(value: unknown) {
  const text = String(value || "").trim()
  if (!text) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("Data da promocao invalida.")
  }
  return text
}

function cleanTime(value: unknown, fallback: string) {
  const text = String(value || fallback).trim()
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw new Error("Horario da promocao invalido.")
  }
  return text
}

function cleanLabel(value: unknown) {
  return String(value || "Oferta")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40) || "Oferta"
}

function mapPromotion(row: PromotionRow): ProductPromotion {
  return {
    id: row.id,
    productId: Number(row.product_id),
    productName: row.product_name,
    normalPrice: Number(row.normal_price),
    promotionalPrice: Number(row.promotional_price),
    ...(dateOnly(row.starts_on)
      ? { startDate: dateOnly(row.starts_on) }
      : {}),
    ...(dateOnly(row.ends_on)
      ? { endDate: dateOnly(row.ends_on) }
      : {}),
    daysOfWeek: normalizedDays(row.days_of_week),
    startTime: timeOnly(row.start_time),
    endTime: timeOnly(row.end_time),
    recurringWeekly: Boolean(row.recurring_weekly),
    active: Boolean(row.active),
    highlight: Boolean(row.highlight),
    label: row.label || "Oferta",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function validateInput(
  input: ProductPromotionInput,
  normalPrice: number,
) {
  const productId = Math.floor(Number(input.productId))
  const promotionalPrice = Number(
    Number(input.promotionalPrice).toFixed(2),
  )
  const daysOfWeek = normalizedDays(input.daysOfWeek)
  const startDate = cleanDate(input.startDate)
  const endDate = cleanDate(input.endDate)
  const startTime = cleanTime(input.startTime, "00:00")
  const endTime = cleanTime(input.endTime, "23:59")

  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error("Selecione um produto valido.")
  }

  if (
    !Number.isFinite(promotionalPrice) ||
    promotionalPrice <= 0
  ) {
    throw new Error("Informe um preco promocional valido.")
  }

  if (
    !Number.isFinite(normalPrice) ||
    normalPrice <= 0
  ) {
    throw new Error("O produto precisa ter um preco normal valido.")
  }

  if (promotionalPrice >= normalPrice) {
    throw new Error(
      "O preco promocional precisa ser menor que o preco normal.",
    )
  }

  if (!daysOfWeek.length) {
    throw new Error("Selecione pelo menos um dia da semana.")
  }

  if (startDate && endDate && endDate < startDate) {
    throw new Error(
      "A data final nao pode ser anterior a data inicial.",
    )
  }

  if (endTime <= startTime) {
    throw new Error(
      "O horario final precisa ser posterior ao horario inicial.",
    )
  }

  return {
    productId,
    promotionalPrice,
    startDate,
    endDate,
    daysOfWeek,
    startTime,
    endTime,
    recurringWeekly: Boolean(input.recurringWeekly),
    active: Boolean(input.active),
    highlight: Boolean(input.highlight),
    label: cleanLabel(input.label),
  }
}

async function productNormalPrice(
  client: PoolClient,
  organizationId: string,
  productId: number,
) {
  const result = await client.query<{
    price: string | number
  }>(
    `
      SELECT price
      FROM sf_products
      WHERE organization_id = $1
        AND id = $2
      LIMIT 1
    `,
    [organizationId, productId],
  )

  const row = result.rows[0]
  if (!row) {
    throw new Error("Produto nao encontrado nesta empresa.")
  }

  return Number(row.price)
}

export async function isProductPromotionsReady() {
  const result = await getPostgresPool().query<{
    ready: boolean
  }>(
    `
      SELECT
        to_regclass(
          'public.sf_product_promotions'
        ) IS NOT NULL AS ready
    `,
  )

  return Boolean(result.rows[0]?.ready)
}

export async function getTenantProductPromotions(
  organizationId: string,
  options?: { includeInactive?: boolean },
): Promise<ProductPromotion[]> {
  try {
    const result = await getPostgresPool().query<PromotionRow>(
      `
        SELECT
          promo.id,
          promo.product_id,
          product.name AS product_name,
          product.price AS normal_price,
          promo.promotional_price,
          promo.starts_on,
          promo.ends_on,
          promo.days_of_week,
          promo.start_time::text,
          promo.end_time::text,
          promo.recurring_weekly,
          promo.active,
          promo.highlight,
          promo.label,
          promo.created_at,
          promo.updated_at
        FROM sf_product_promotions promo
        INNER JOIN sf_products product
          ON product.organization_id =
            promo.organization_id
         AND product.id = promo.product_id
        WHERE promo.organization_id = $1
          ${
            options?.includeInactive
              ? ""
              : "AND promo.active = true"
          }
        ORDER BY
          promo.active DESC,
          promo.updated_at DESC,
          promo.created_at DESC
      `,
      [organizationId],
    )

    return result.rows.map(mapPromotion)
  } catch (error) {
    if ((error as { code?: string })?.code === "42P01") {
      return []
    }
    throw error
  }
}

export function promotionIsActiveNow(
  promotion: ProductPromotion,
  timeZone?: string,
  at = new Date(),
) {
  if (!promotion.active) return false

  const now = zonedParts(at, timeZone)

  if (
    promotion.startDate &&
    now.date < promotion.startDate
  ) {
    return false
  }

  if (
    promotion.endDate &&
    now.date > promotion.endDate
  ) {
    return false
  }

  if (
    !promotion.daysOfWeek.includes(
      now.day,
    )
  ) {
    return false
  }

  return (
    now.time >= promotion.startTime &&
    now.time <= promotion.endTime
  )
}

function bestPromotion(
  promotions: ProductPromotion[],
) {
  return [...promotions].sort(
    (a, b) =>
      a.promotionalPrice -
        b.promotionalPrice ||
      b.updatedAt.localeCompare(
        a.updatedAt,
      ),
  )[0]
}

function previewForPromotion(
  promotion: ProductPromotion,
  timeZone?: string,
  at = new Date(),
): ProductPromotionPreview {
  const now = zonedParts(at, timeZone)
  const end = zonedDateTime(
    now.date,
    promotion.endTime,
    timeZone,
  )
  const validUntil = Number.isFinite(
    end.getTime(),
  )
    ? new Date(
        end.getTime() + 59_999,
      ).toISOString()
    : at.toISOString()

  return {
    id: promotion.id,
    promotionalPrice:
      promotion.promotionalPrice,
    label: promotion.label,
    highlight: promotion.highlight,
    validUntil,
  }
}

export function applyActivePromotionsToProducts(
  products: Product[],
  promotions: ProductPromotion[],
  timeZone?: string,
  at = new Date(),
): Product[] {
  const activeByProduct =
    new Map<
      number,
      ProductPromotion[]
    >()

  for (const promotion of promotions) {
    if (
      !promotionIsActiveNow(
        promotion,
        timeZone,
        at,
      )
    ) {
      continue
    }

    const list =
      activeByProduct.get(
        promotion.productId,
      ) || []

    list.push(promotion)
    activeByProduct.set(
      promotion.productId,
      list,
    )
  }

  return products.map((product) => {
    const promotion = bestPromotion(
      activeByProduct.get(product.id) ||
        [],
    )

    if (
      !promotion ||
      promotion.promotionalPrice >=
        product.price
    ) {
      return {
        ...product,
        promotion: undefined,
      }
    }

    return {
      ...product,
      promotion: previewForPromotion(
        promotion,
        timeZone,
        at,
      ),
    }
  })
}

export async function createTenantProductPromotion(
  organizationId: string,
  input: ProductPromotionInput,
) {
  const client =
    await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [
        `saborflow-promotions:${organizationId}`,
      ],
    )

    const normalPrice =
      await productNormalPrice(
        client,
        organizationId,
        Number(input.productId),
      )

    const clean = validateInput(
      input,
      normalPrice,
    )

    const inserted =
      await client.query<{
        id: string
      }>(
        `
          INSERT INTO sf_product_promotions (
            organization_id,
            product_id,
            promotional_price,
            starts_on,
            ends_on,
            days_of_week,
            start_time,
            end_time,
            recurring_weekly,
            active,
            highlight,
            label
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6::smallint[],
            $7::time,
            $8::time,
            $9, $10, $11, $12
          )
          RETURNING id
        `,
        [
          organizationId,
          clean.productId,
          clean.promotionalPrice,
          clean.startDate || null,
          clean.endDate || null,
          clean.daysOfWeek,
          clean.startTime,
          clean.endTime,
          clean.recurringWeekly,
          clean.active,
          clean.highlight,
          clean.label,
        ],
      )

    await client.query("COMMIT")

    const promotions =
      await getTenantProductPromotions(
        organizationId,
        { includeInactive: true },
      )

    return (
      promotions.find(
        (item) =>
          item.id ===
          inserted.rows[0]?.id,
      ) || null
    )
  } catch (error) {
    await client
      .query("ROLLBACK")
      .catch(() => undefined)

    if (
      (error as { code?: string })
        ?.code === "42P01"
    ) {
      throw new Error(
        "A migration 039 de promocoes ainda nao foi aplicada.",
      )
    }

    throw error
  } finally {
    client.release()
  }
}

export async function updateTenantProductPromotion(
  organizationId: string,
  id: string,
  patch: Partial<ProductPromotionInput>,
) {
  const client =
    await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [
        `saborflow-promotions:${organizationId}`,
      ],
    )

    const currentResult =
      await client.query<PromotionRow>(
        `
          SELECT
            promo.id,
            promo.product_id,
            product.name AS product_name,
            product.price AS normal_price,
            promo.promotional_price,
            promo.starts_on,
            promo.ends_on,
            promo.days_of_week,
            promo.start_time::text,
            promo.end_time::text,
            promo.recurring_weekly,
            promo.active,
            promo.highlight,
            promo.label,
            promo.created_at,
            promo.updated_at
          FROM sf_product_promotions promo
          INNER JOIN sf_products product
            ON product.organization_id =
              promo.organization_id
           AND product.id =
              promo.product_id
          WHERE promo.organization_id = $1
            AND promo.id = $2
          LIMIT 1
          FOR UPDATE OF promo
        `,
        [organizationId, id],
      )

    const current =
      currentResult.rows[0]
        ? mapPromotion(
            currentResult.rows[0],
          )
        : null

    if (!current) {
      await client.query("ROLLBACK")
      return null
    }

    const productId =
      patch.productId !== undefined
        ? Number(patch.productId)
        : current.productId

    const normalPrice =
      await productNormalPrice(
        client,
        organizationId,
        productId,
      )

    const clean = validateInput(
      {
        productId,
        promotionalPrice:
          patch.promotionalPrice ??
          current.promotionalPrice,
        startDate:
          patch.startDate !== undefined
            ? patch.startDate
            : current.startDate,
        endDate:
          patch.endDate !== undefined
            ? patch.endDate
            : current.endDate,
        daysOfWeek:
          patch.daysOfWeek ??
          current.daysOfWeek,
        startTime:
          patch.startTime ??
          current.startTime,
        endTime:
          patch.endTime ??
          current.endTime,
        recurringWeekly:
          patch.recurringWeekly ??
          current.recurringWeekly,
        active:
          patch.active ??
          current.active,
        highlight:
          patch.highlight ??
          current.highlight,
        label:
          patch.label ??
          current.label,
      },
      normalPrice,
    )

    await client.query(
      `
        UPDATE sf_product_promotions
        SET
          product_id = $3,
          promotional_price = $4,
          starts_on = $5,
          ends_on = $6,
          days_of_week =
            $7::smallint[],
          start_time = $8::time,
          end_time = $9::time,
          recurring_weekly = $10,
          active = $11,
          highlight = $12,
          label = $13,
          updated_at = now()
        WHERE organization_id = $1
          AND id = $2
      `,
      [
        organizationId,
        id,
        clean.productId,
        clean.promotionalPrice,
        clean.startDate || null,
        clean.endDate || null,
        clean.daysOfWeek,
        clean.startTime,
        clean.endTime,
        clean.recurringWeekly,
        clean.active,
        clean.highlight,
        clean.label,
      ],
    )

    await client.query("COMMIT")

    const promotions =
      await getTenantProductPromotions(
        organizationId,
        { includeInactive: true },
      )

    return (
      promotions.find(
        (item) => item.id === id,
      ) || null
    )
  } catch (error) {
    await client
      .query("ROLLBACK")
      .catch(() => undefined)

    if (
      (error as { code?: string })
        ?.code === "42P01"
    ) {
      throw new Error(
        "A migration 039 de promocoes ainda nao foi aplicada.",
      )
    }

    throw error
  } finally {
    client.release()
  }
}

export async function getCheckoutPromotionPriceMap(
  client: PoolClient,
  organizationId: string,
  timeZone: string | undefined,
  timing: "now" | "scheduled" | undefined,
  requestedFor?: string,
  minimumLeadMinutes = 0,
) {
  const prices =
    new Map<
      number,
      {
        normalPrice: number
        promotionalPrice: number
      }
    >()

  // PROMO_SCHEDULE_SAME_DAY_1482
  // A promocao vale para "Para agora" e tambem para agendamento
  // do mesmo dia, desde que esteja ativa no momento do checkout.
  if (
    timing !== "now" &&
    timing !== "scheduled"
  ) {
    return prices
  }

  if (
    timing === "scheduled" &&
    !requestedFor
  ) {
    return prices
  }

  const now = new Date()
  const nowParts =
    zonedParts(now, timeZone)

  let fulfillment =
    requestedFor
      ? new Date(requestedFor)
      : new Date(
          now.getTime() +
            Math.max(
              0,
              Number(
                minimumLeadMinutes,
              ) || 0,
            ) *
              60_000,
        )

  if (
    !Number.isFinite(
      fulfillment.getTime(),
    )
  ) {
    fulfillment = now
  }

  // Tanto no pedido imediato quanto no agendamento:
  // nunca permite usar o preco promocional para receber em outro dia.
  if (
    zonedParts(
      fulfillment,
      timeZone,
    ).date !== nowParts.date
  ) {
    return prices
  }

  try {
    const result =
      await client.query<PromotionRow>(
        `
          SELECT
            promo.id,
            promo.product_id,
            product.name
              AS product_name,
            product.price
              AS normal_price,
            promo.promotional_price,
            promo.starts_on,
            promo.ends_on,
            promo.days_of_week,
            promo.start_time::text,
            promo.end_time::text,
            promo.recurring_weekly,
            promo.active,
            promo.highlight,
            promo.label,
            promo.created_at,
            promo.updated_at
          FROM sf_product_promotions promo
          INNER JOIN sf_products product
            ON product.organization_id =
              promo.organization_id
           AND product.id =
              promo.product_id
          WHERE promo.organization_id = $1
            AND promo.active = true
          ORDER BY
            promo.product_id ASC,
            promo.promotional_price ASC,
            promo.updated_at DESC
        `,
        [organizationId],
      )

    const grouped =
      new Map<
        number,
        ProductPromotion[]
      >()

    for (const row of result.rows) {
      const promotion =
        mapPromotion(row)

      if (
        !promotionIsActiveNow(
          promotion,
          timeZone,
          now,
        )
      ) {
        continue
      }

      const list =
        grouped.get(
          promotion.productId,
        ) || []

      list.push(promotion)
      grouped.set(
        promotion.productId,
        list,
      )
    }

    for (
      const [
        productId,
        promotions,
      ] of grouped
    ) {
      const promotion =
        bestPromotion(promotions)

      if (
        !promotion ||
        promotion.promotionalPrice >=
          promotion.normalPrice
      ) {
        continue
      }

      prices.set(
        productId,
        {
          normalPrice:
            promotion.normalPrice,
          promotionalPrice:
            promotion.promotionalPrice,
        },
      )
    }

    return prices
  } catch (error) {
    if (
      (error as { code?: string })
        ?.code === "42P01"
    ) {
      return prices
    }
    throw error
  }
}

export function applyCheckoutPromotionUnitPrice(
  prices: Map<
    number,
    {
      normalPrice: number
      promotionalPrice: number
    }
  >,
  productId: number,
  calculatedUnitPrice: number,
) {
  const promotion =
    prices.get(Number(productId))

  const current =
    Number(calculatedUnitPrice)

  if (
    !promotion ||
    !Number.isFinite(current)
  ) {
    return Number(
      (Number.isFinite(current)
        ? current
        : 0
      ).toFixed(2),
    )
  }

  // O pricing do checkout ja inclui os adicionais.
  // Trocamos somente o preco-base normal pelo promocional.
  const modifierAmount =
    Math.max(
      0,
      current -
        Number(promotion.normalPrice),
    )

  return Number(
    (
      Number(
        promotion.promotionalPrice,
      ) + modifierAmount
    ).toFixed(2),
  )
}
