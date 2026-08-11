import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { randomUUID } from "node:crypto"
import pg from "pg"

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("ERRO: DATABASE_URL não está configurada.")
  process.exit(1)
}

const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
if (!adminEmail) {
  console.error("ERRO: ADMIN_EMAIL não está configurado.")
  process.exit(1)
}

const force = process.argv.includes("--force")

const dataFile =
  process.env.DATA_FILE ||
  path.join(process.cwd(), "data", "store.json")

const seedFile =
  path.join(process.cwd(), "data", "store.seed.json")

async function readStore() {
  for (const file of [dataFile, seedFile]) {
    try {
      const raw = await fs.readFile(file, "utf8")
      return { file, store: JSON.parse(raw) }
    } catch {
      // tenta o próximo
    }
  }

  throw new Error(
    `Não foi possível ler ${dataFile} nem ${seedFile}.`,
  )
}

function cents(value) {
  return Math.round(Number(value || 0) * 100)
}

function validateOrders(orders) {
  const errors = []
  const ids = new Set()
  const refs = new Set()

  for (let index = 0; index < orders.length; index += 1) {
    const order = orders[index]
    const label = `pedido[${index}] id=${order?.id ?? "?"}`

    if (!Number.isInteger(Number(order?.id)) || Number(order.id) <= 0) {
      errors.push(`${label}: id inválido`)
      continue
    }

    if (ids.has(Number(order.id))) {
      errors.push(`${label}: id duplicado`)
    }
    ids.add(Number(order.id))

    const reference = String(order?.reference || "").trim().toLowerCase()
    if (!reference) {
      errors.push(`${label}: referência vazia`)
    } else if (refs.has(reference)) {
      errors.push(`${label}: referência duplicada`)
    }
    refs.add(reference)

    const items = Array.isArray(order?.items) ? order.items : []
    if (!items.length) {
      errors.push(`${label}: sem itens`)
      continue
    }

    let itemsSubtotal = 0

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex]
      const quantity = Number(item?.quantity)
      const unitPrice = Number(item?.unitPrice)
      const subtotal = Number(item?.subtotal)

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0 ||
        !Number.isFinite(subtotal) ||
        subtotal < 0
      ) {
        errors.push(
          `${label}: item ${itemIndex + 1} possui valores inválidos`,
        )
        continue
      }

      if (Math.abs(cents(quantity * unitPrice) - cents(subtotal)) > 1) {
        errors.push(
          `${label}: item ${itemIndex + 1} subtotal divergente`,
        )
      }

      itemsSubtotal += subtotal
    }

    if (Math.abs(cents(itemsSubtotal) - cents(order.subtotal)) > 1) {
      errors.push(`${label}: subtotal do pedido divergente dos itens`)
    }

    const expectedTotal =
      Number(order.subtotal || 0) -
      Number(order.discount || 0) +
      Number(order.deliveryFee || 0)

    if (Math.abs(cents(expectedTotal) - cents(order.total)) > 1) {
      errors.push(`${label}: total final divergente`)
    }
  }

  return errors
}

function validDate(value, label) {
  const date = new Date(value || "")
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data inválida em ${label}.`)
  }
  return date
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  connectionTimeoutMillis: 10000,
})

async function main() {
  const { file, store } = await readStore()
  const orders = Array.isArray(store.orders) ? store.orders : []

  const validationErrors = validateOrders(orders)

  if (validationErrors.length) {
    console.error("")
    console.error(
      `Importação cancelada: ${validationErrors.length} inconsistência(s) encontrada(s).`,
    )
    for (const issue of validationErrors.slice(0, 20)) {
      console.error(`- ${issue}`)
    }
    if (validationErrors.length > 20) {
      console.error(
        `- ... e mais ${validationErrors.length - 20} inconsistência(s)`,
      )
    }
    process.exit(1)
  }

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

    const schemaResult = await client.query(
      `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'sf_orders_state'
      `,
    )

    if (!schemaResult.rowCount) {
      throw new Error(
        "Migration 004 ainda não foi aplicada. Rode node scripts/migrate-multiempresa.mjs primeiro.",
      )
    }

    const existingState = await client.query(
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
      [organization.id],
    )

    if (existingState.rows[0]?.ready && !force) {
      console.log("")
      console.log("Pedidos já foram importados para esta organização.")
      console.log(`Empresa: ${organization.trade_name}`)
      console.log(`Pedidos: ${existingState.rows[0].orders_count}`)
      console.log(`Itens: ${existingState.rows[0].items_count}`)
      console.log("")
      console.log(
        "Nada foi alterado. Não use --force sem necessidade.",
      )
      return
    }

    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`saborflow-orders:${organization.id}`],
    )

    await client.query(
      "DELETE FROM sf_orders WHERE organization_id = $1",
      [organization.id],
    )

    let itemsCount = 0
    let totalAmount = 0

    for (const order of orders) {
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
            $21, $22, $23, $24, 'legacy-import', $25, $26
          )
        `,
        [
          organization.id,
          Number(order.id),
          String(order.code || `#${order.id}`),
          String(order.reference),
          order.type === "delivery" ? "delivery" : "pickup",
          String(order.status),
          ["WEB", "PDV", "APP"].includes(String(order.channel))
            ? String(order.channel)
            : "WEB",
          Number(order.subtotal || 0),
          Number(order.discount || 0),
          order.couponCode || null,
          Number(order.deliveryFee || 0),
          Number(order.total || 0),
          String(order.paymentStatus || "unpaid"),
          String(order.paymentMethod || "pix"),
          order.changeFor || null,
          order.notes || null,
          JSON.stringify(order.customer || {}),
          order.courierId ?? null,
          order.courierName || null,
          order.deliveryZoneId ?? null,
          order.deliveryZoneName || null,
          validDate(order.requestedFor, `pedido ${order.id} requestedFor`),
          Boolean(order.scheduled),
          order.printedAt
            ? validDate(order.printedAt, `pedido ${order.id} printedAt`)
            : null,
          validDate(order.createdAt, `pedido ${order.id} createdAt`),
          validDate(order.updatedAt, `pedido ${order.id} updatedAt`),
        ],
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
            organization.id,
            Number(order.id),
            index + 1,
            Number(item.productId),
            String(item.name),
            Number(item.quantity),
            Number(item.unitPrice),
            Number(item.subtotal),
          ],
        )

        itemsCount += 1
      }

      totalAmount += Number(order.total || 0)
    }

    totalAmount = Number(totalAmount.toFixed(2))

    await client.query(
      `
        INSERT INTO sf_orders_state (
          organization_id,
          ready,
          source,
          orders_count,
          items_count,
          total_amount,
          imported_at,
          updated_at
        )
        VALUES ($1, true, $2, $3, $4, $5, now(), now())
        ON CONFLICT (organization_id)
        DO UPDATE SET
          ready = true,
          source = EXCLUDED.source,
          orders_count = EXCLUDED.orders_count,
          items_count = EXCLUDED.items_count,
          total_amount = EXCLUDED.total_amount,
          imported_at = now(),
          updated_at = now()
      `,
      [
        organization.id,
        file,
        orders.length,
        itemsCount,
        totalAmount,
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
          'orders.import',
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
          orders: orders.length,
          items: itemsCount,
          totalAmount,
          forced: force,
        }),
        adminEmail,
      ],
    )

    await client.query("COMMIT")

    console.log("")
    console.log("SaborFlow - pedidos multiempresa importados com sucesso.")
    console.log(`Empresa: ${organization.trade_name}`)
    console.log(`Slug: ${organization.slug}`)
    console.log(`Organization ID: ${organization.id}`)
    console.log(`Pedidos: ${orders.length}`)
    console.log(`Itens: ${itemsCount}`)
    console.log(`Total histórico: R$ ${totalAmount.toFixed(2)}`)
    console.log(`Origem: ${file}`)
    console.log("")
    console.log("store.json não foi apagado nem alterado.")

    if (file.endsWith("store.seed.json")) {
      console.log("")
      console.log(
        "ATENÇÃO: a origem usada foi store.seed.json. Se você esperava pedidos históricos reais, confira DATA_FILE/Volume antes de continuar.",
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
  console.error("Falha na importação dos pedidos:")
  console.error(error)
  process.exit(1)
})
