import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { randomUUID } from "node:crypto"
import pg from "pg"

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error(
    "ERRO: DATABASE_URL não está configurada.",
  )
  process.exit(1)
}

const adminEmail = (
  process.env.ADMIN_EMAIL || ""
)
  .trim()
  .toLowerCase()

if (!adminEmail) {
  console.error(
    "ERRO: ADMIN_EMAIL não está configurado.",
  )
  process.exit(1)
}

const force = process.argv.includes("--force")

const volumeMount = (
  process.env.RAILWAY_VOLUME_MOUNT_PATH || ""
).trim()

const dataFile =
  process.env.DATA_FILE ||
  (volumeMount
    ? path.join(volumeMount, "store.json")
    : path.join(
        process.cwd(),
        "data",
        "store.json",
      ))

const seedFile = path.join(
  process.cwd(),
  "data",
  "store.seed.json",
)

async function readStore() {
  for (const file of [dataFile, seedFile]) {
    try {
      const raw = await fs.readFile(file, "utf8")
      return {
        file,
        store: JSON.parse(raw),
      }
    } catch {
      // tenta o próximo
    }
  }

  throw new Error(
    `Não foi possível ler ${dataFile} nem ${seedFile}.`,
  )
}

function validDate(value) {
  const date = new Date(value || "")
  return Number.isNaN(date.getTime())
    ? new Date()
    : date
}

function number(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function validateStore(store) {
  const errors = []

  const collections = [
    ["coupons", store.coupons],
    ["feedbacks", store.feedbacks],
    ["cashSessions", store.cashSessions],
    ["financialEntries", store.financialEntries],
    ["deliveryZones", store.deliveryZones],
    ["couriers", store.couriers],
  ]

  for (const [name, value] of collections) {
    if (value !== undefined && !Array.isArray(value)) {
      errors.push(`${name}: esperado array`)
    }
  }

  const coupons = Array.isArray(store.coupons)
    ? store.coupons
    : []

  const couponIds = new Set()
  const couponCodes = new Set()

  for (const coupon of coupons) {
    const id = Number(coupon?.id)
    const code = String(coupon?.code || "")
      .trim()
      .toLowerCase()

    if (!Number.isInteger(id) || id <= 0) {
      errors.push("cupom com id inválido")
    } else if (couponIds.has(id)) {
      errors.push(`cupom id ${id} duplicado`)
    }
    couponIds.add(id)

    if (!code) {
      errors.push(`cupom ${id}: código vazio`)
    } else if (couponCodes.has(code)) {
      errors.push(`cupom ${id}: código duplicado`)
    }
    couponCodes.add(code)
  }

  const feedbacks = Array.isArray(store.feedbacks)
    ? store.feedbacks
    : []

  const feedbackIds = new Set()
  const feedbackOrders = new Set()

  for (const feedback of feedbacks) {
    const id = Number(feedback?.id)
    const orderId = Number(feedback?.orderId)

    if (!Number.isInteger(id) || id <= 0) {
      errors.push("feedback com id inválido")
    } else if (feedbackIds.has(id)) {
      errors.push(`feedback id ${id} duplicado`)
    }
    feedbackIds.add(id)

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      errors.push(
        `feedback ${id}: orderId inválido`,
      )
    } else if (feedbackOrders.has(orderId)) {
      errors.push(
        `feedback ${id}: pedido avaliado mais de uma vez`,
      )
    }
    feedbackOrders.add(orderId)
  }

  const cashSessions = Array.isArray(
    store.cashSessions,
  )
    ? store.cashSessions
    : []

  const openCash = cashSessions.filter(
    (session) => !session?.closedAt,
  )

  if (openCash.length > 1) {
    errors.push(
      "há mais de um caixa aberto no legado",
    )
  }

  const deliveryZones = Array.isArray(
    store.deliveryZones,
  )
    ? store.deliveryZones
    : []

  for (const zone of deliveryZones) {
    const shape =
      zone?.shape === "polygon"
        ? "polygon"
        : "circle"
    const points = Array.isArray(zone?.points)
      ? zone.points
      : []

    if (shape === "polygon" && points.length < 3) {
      errors.push(
        `área ${zone?.id}: polígono com menos de 3 pontos`,
      )
    }
  }

  return errors
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  connectionTimeoutMillis: 10_000,
})

async function main() {
  const { file, store } = await readStore()

  const errors = validateStore(store)

  if (errors.length) {
    console.error("")
    console.error(
      `Importação cancelada: ${errors.length} inconsistência(s).`,
    )

    for (const error of errors.slice(0, 30)) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  const coupons = Array.isArray(store.coupons)
    ? store.coupons
    : []
  const feedbacks = Array.isArray(store.feedbacks)
    ? store.feedbacks
    : []
  const cashSessions = Array.isArray(
    store.cashSessions,
  )
    ? store.cashSessions
    : []
  const financialEntries = Array.isArray(
    store.financialEntries,
  )
    ? store.financialEntries
    : []
  const deliveryZones = Array.isArray(
    store.deliveryZones,
  )
    ? store.deliveryZones
    : []
  const couriers = Array.isArray(store.couriers)
    ? store.couriers
    : []

  const client = await pool.connect()

  try {
    const orgResult = await client.query(
      `
        SELECT
          o.id,
          o.trade_name,
          o.slug
        FROM sf_users u
        INNER JOIN sf_memberships m
          ON m.user_id = u.id
         AND m.status = 'active'
        INNER JOIN sf_organizations o
          ON o.id = m.organization_id
         AND o.status IN ('active', 'trial')
        WHERE lower(u.email) = lower($1)
        ORDER BY
          CASE m.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            ELSE 3
          END,
          m.created_at ASC
        LIMIT 1
      `,
      [adminEmail],
    )

    const organization = orgResult.rows[0]

    if (!organization) {
      throw new Error(
        "Nenhuma organização ativa foi encontrada para ADMIN_EMAIL.",
      )
    }

    const schema = await client.query(
      `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'sf_operations_state'
        LIMIT 1
      `,
    )

    if (!schema.rowCount) {
      throw new Error(
        "Migration 006 ainda não foi aplicada. Rode node scripts/migrate-multiempresa.mjs primeiro.",
      )
    }

    const state = await client.query(
      `
        SELECT ready
        FROM sf_operations_state
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organization.id],
    )

    if (state.rows[0]?.ready && !force) {
      console.log("")
      console.log(
        "Operação já foi importada para esta organização.",
      )
      console.log(
        `Empresa: ${organization.trade_name}`,
      )
      console.log("")
      console.log(
        "Nada foi alterado. Não use --force sem necessidade.",
      )
      return
    }

    // Feedback só pode ser importado se os pedidos correspondentes
    // realmente pertencem à mesma organização.
    for (const feedback of feedbacks) {
      const exists = await client.query(
        `
          SELECT 1
          FROM sf_orders
          WHERE organization_id = $1
            AND id = $2
            AND lower(reference) = lower($3)
          LIMIT 1
        `,
        [
          organization.id,
          Number(feedback.orderId),
          String(feedback.orderReference || ""),
        ],
      )

      if (!exists.rowCount) {
        throw new Error(
          `Feedback ${feedback.id} referencia um pedido que não existe na organização.`,
        )
      }
    }

    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`saborflow-operations:${organization.id}`],
    )

    await client.query(
      "DELETE FROM sf_feedbacks WHERE organization_id = $1",
      [organization.id],
    )
    await client.query(
      "DELETE FROM sf_coupons WHERE organization_id = $1",
      [organization.id],
    )
    await client.query(
      "DELETE FROM sf_cash_sessions WHERE organization_id = $1",
      [organization.id],
    )
    await client.query(
      "DELETE FROM sf_financial_entries WHERE organization_id = $1",
      [organization.id],
    )
    await client.query(
      "DELETE FROM sf_delivery_zones WHERE organization_id = $1",
      [organization.id],
    )
    await client.query(
      "DELETE FROM sf_couriers WHERE organization_id = $1",
      [organization.id],
    )

    for (const coupon of coupons) {
      await client.query(
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
            $8, $9, $10, $11
          )
        `,
        [
          organization.id,
          Number(coupon.id),
          String(coupon.code || "")
            .trim()
            .toUpperCase(),
          String(coupon.description || ""),
          coupon.type === "fixed"
            ? "fixed"
            : "percent",
          Math.max(0, number(coupon.value)),
          Math.max(
            0,
            number(coupon.minimumOrder),
          ),
          coupon.active !== false,
          coupon.expiresAt
            ? validDate(coupon.expiresAt)
            : null,
          validDate(coupon.createdAt),
          validDate(coupon.updatedAt),
        ],
      )
    }

    for (const feedback of feedbacks) {
      await client.query(
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
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          )
        `,
        [
          organization.id,
          Number(feedback.id),
          Number(feedback.orderId),
          String(feedback.orderReference || ""),
          String(feedback.customerName || ""),
          Math.max(
            1,
            Math.min(
              5,
              Math.floor(number(feedback.rating)),
            ),
          ),
          String(feedback.reaction || ""),
          String(feedback.comment || ""),
          validDate(feedback.createdAt),
        ],
      )
    }

    for (const session of cashSessions) {
      await client.query(
        `
          INSERT INTO sf_cash_sessions (
            organization_id,
            id,
            opened_at,
            opened_by,
            opening_amount,
            closed_at,
            closing_amount,
            notes
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
          )
        `,
        [
          organization.id,
          Number(session.id),
          validDate(session.openedAt),
          String(session.openedBy || ""),
          Math.max(
            0,
            number(session.openingAmount),
          ),
          session.closedAt
            ? validDate(session.closedAt)
            : null,
          session.closingAmount !== undefined
            ? Math.max(
                0,
                number(session.closingAmount),
              )
            : null,
          String(session.notes || ""),
        ],
      )
    }

    for (const entry of financialEntries) {
      await client.query(
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
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          organization.id,
          Number(entry.id),
          entry.type === "expense"
            ? "expense"
            : "income",
          String(entry.category || "Geral"),
          String(entry.description || ""),
          Math.max(0, number(entry.amount)),
          validDate(entry.createdAt),
        ],
      )
    }

    for (const zone of deliveryZones) {
      const points = Array.isArray(zone.points)
        ? zone.points
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
        zone.shape === "polygon" &&
        points.length >= 3
          ? "polygon"
          : "circle"

      await client.query(
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
            $1, $2, $3, $4, $5, $6, $7,
            $8::jsonb, $9, $10, $11, $12, $13
          )
        `,
        [
          organization.id,
          Number(zone.id),
          String(zone.name || ""),
          String(zone.color || "#f97316"),
          Math.max(0, number(zone.fee)),
          zone.active !== false,
          shape,
          JSON.stringify(points),
          number(zone.centerLat),
          number(zone.centerLng),
          Math.max(
            50,
            Math.round(number(zone.radiusMeters)),
          ),
          validDate(zone.createdAt),
          validDate(zone.updatedAt),
        ],
      )
    }

    for (const courier of couriers) {
      await client.query(
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
            $1, $2, $3, $4, $5, $6, $7, $8
          )
        `,
        [
          organization.id,
          Number(courier.id),
          String(courier.name || ""),
          String(courier.phone || ""),
          String(courier.vehicle || ""),
          courier.active !== false,
          validDate(courier.createdAt),
          validDate(courier.updatedAt),
        ],
      )
    }

    await client.query(
      `
        INSERT INTO sf_operations_state (
          organization_id,
          ready,
          source,
          coupons_count,
          feedbacks_count,
          cash_sessions_count,
          financial_entries_count,
          delivery_zones_count,
          couriers_count,
          imported_at,
          updated_at
        )
        VALUES (
          $1, true, $2, $3, $4, $5, $6, $7, $8,
          now(), now()
        )
        ON CONFLICT (organization_id)
        DO UPDATE SET
          ready = true,
          source = EXCLUDED.source,
          coupons_count = EXCLUDED.coupons_count,
          feedbacks_count = EXCLUDED.feedbacks_count,
          cash_sessions_count = EXCLUDED.cash_sessions_count,
          financial_entries_count = EXCLUDED.financial_entries_count,
          delivery_zones_count = EXCLUDED.delivery_zones_count,
          couriers_count = EXCLUDED.couriers_count,
          imported_at = now(),
          updated_at = now()
      `,
      [
        organization.id,
        file,
        coupons.length,
        feedbacks.length,
        cashSessions.length,
        financialEntries.length,
        deliveryZones.length,
        couriers.length,
      ],
    )

    await client.query(
      `
        INSERT INTO sf_audit_log (
          id,
          organization_id,
          user_id,
          action,
          entity_type,
          entity_id,
          metadata
        )
        SELECT
          $1,
          $2,
          u.id,
          'operations.import',
          'organization',
          $3,
          $4::jsonb
        FROM sf_users u
        WHERE lower(u.email) = lower($5)
        LIMIT 1
      `,
      [
        randomUUID(),
        organization.id,
        String(organization.id),
        JSON.stringify({
          source: file,
          coupons: coupons.length,
          feedbacks: feedbacks.length,
          cashSessions: cashSessions.length,
          financialEntries:
            financialEntries.length,
          deliveryZones: deliveryZones.length,
          couriers: couriers.length,
          forced: force,
        }),
        adminEmail,
      ],
    )

    await client.query("COMMIT")

    console.log("")
    console.log(
      "SaborFlow - operação multiempresa importada com sucesso.",
    )
    console.log(
      `Empresa: ${organization.trade_name}`,
    )
    console.log(`Slug: ${organization.slug}`)
    console.log(
      `Organization ID: ${organization.id}`,
    )
    console.log(`Cupons: ${coupons.length}`)
    console.log(
      `Avaliações: ${feedbacks.length}`,
    )
    console.log(
      `Sessões de caixa: ${cashSessions.length}`,
    )
    console.log(
      `Lançamentos financeiros: ${financialEntries.length}`,
    )
    console.log(
      `Áreas de entrega: ${deliveryZones.length}`,
    )
    console.log(
      `Entregadores: ${couriers.length}`,
    )
    console.log(`Origem: ${file}`)
    console.log("")
    console.log(
      "store.json não foi apagado nem alterado.",
    )

    if (file.endsWith("store.seed.json")) {
      console.log("")
      console.log(
        "ATENÇÃO: a origem usada foi store.seed.json. Como a Fase 6.1 já configurou /data/store.json, pare e confira DATA_FILE/Volume antes de avançar.",
      )
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {
      // nada
    }
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(
    "Falha na importação da operação:",
  )
  console.error(error)
  process.exit(1)
})
