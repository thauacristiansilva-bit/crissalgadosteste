import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
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

const volumeMount =
  (process.env.RAILWAY_VOLUME_MOUNT_PATH || "").trim()

const dataFile =
  process.env.DATA_FILE ||
  (volumeMount
    ? path.join(volumeMount, "store.json")
    : path.join(process.cwd(), "data", "store.json"))

const seedFile =
  path.join(process.cwd(), "data", "store.seed.json")

function iso(value) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? undefined
    : date.toISOString()
}

function number(value) {
  return Number(value || 0)
}

function bool(value) {
  return Boolean(value)
}

async function readBaseStore() {
  for (const file of [dataFile, seedFile]) {
    try {
      const raw = await fs.readFile(file, "utf8")
      return {
        file,
        store: JSON.parse(raw),
      }
    } catch {
      // tenta o próximo arquivo
    }
  }

  return {
    file: "empty",
    store: {},
  }
}

async function tableExists(client, table) {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
      LIMIT 1
    `,
    [table],
  )

  return Boolean(result.rowCount)
}

async function main() {
  if (!volumeMount) {
    console.error("")
    console.error(
      "ERRO: este serviço não possui RAILWAY_VOLUME_MOUNT_PATH.",
    )
    console.error(
      "Anexe primeiro um Volume ao serviço crissalgadosteste com Mount Path /data.",
    )
    process.exit(1)
  }

  if (!path.isAbsolute(dataFile)) {
    throw new Error("DATA_FILE precisa ser um caminho absoluto.")
  }

  await fs.mkdir(path.dirname(dataFile), { recursive: true })

  const { file: baseFile, store } = await readBaseStore()

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 10_000,
  })

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

    const hasCatalog =
      (await tableExists(client, "sf_catalog_state")) &&
      (
        await client.query(
          `
            SELECT ready
            FROM sf_catalog_state
            WHERE organization_id = $1
            LIMIT 1
          `,
          [organization.id],
        )
      ).rows[0]?.ready === true

    const hasOrders =
      (await tableExists(client, "sf_orders_state")) &&
      (
        await client.query(
          `
            SELECT ready
            FROM sf_orders_state
            WHERE organization_id = $1
            LIMIT 1
          `,
          [organization.id],
        )
      ).rows[0]?.ready === true

    const hasCustomers =
      (await tableExists(client, "sf_customers_state")) &&
      (
        await client.query(
          `
            SELECT ready
            FROM sf_customers_state
            WHERE organization_id = $1
            LIMIT 1
          `,
          [organization.id],
        )
      ).rows[0]?.ready === true

    let categories = Array.isArray(store.categories)
      ? store.categories
      : []
    let products = Array.isArray(store.products)
      ? store.products
      : []
    let orders = Array.isArray(store.orders)
      ? store.orders
      : []
    let customerAccounts = Array.isArray(store.customerAccounts)
      ? store.customerAccounts
      : []

    if (hasCatalog) {
      const categoryRows = await client.query(
        `
          SELECT
            id,
            name,
            active,
            sort_order,
            created_at,
            updated_at
          FROM sf_categories
          WHERE organization_id = $1
          ORDER BY sort_order ASC, id ASC
        `,
        [organization.id],
      )

      const productRows = await client.query(
        `
          SELECT
            p.id,
            p.name,
            p.description,
            c.name AS category,
            p.price,
            p.active,
            p.featured,
            p.image,
            p.track_stock,
            p.stock,
            p.min_stock,
            p.created_at,
            p.updated_at
          FROM sf_products p
          INNER JOIN sf_categories c
            ON c.organization_id = p.organization_id
           AND c.id = p.category_id
          WHERE p.organization_id = $1
          ORDER BY p.id ASC
        `,
        [organization.id],
      )

      categories = categoryRows.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        active: bool(row.active),
        sortOrder: Number(row.sort_order),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      }))

      products = productRows.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        description: row.description || "",
        category: row.category,
        price: number(row.price),
        active: bool(row.active),
        featured: bool(row.featured),
        image: row.image || "",
        trackStock: bool(row.track_stock),
        stock: Number(row.stock),
        minStock: Number(row.min_stock),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      }))
    }

    if (hasOrders) {
      const orderRows = await client.query(
        `
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
          WHERE organization_id = $1
          ORDER BY id ASC
        `,
        [organization.id],
      )

      const itemRows = await client.query(
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
          ORDER BY order_id ASC, line_no ASC
        `,
        [organization.id],
      )

      const itemsByOrder = new Map()

      for (const row of itemRows.rows) {
        const id = Number(row.order_id)
        const list = itemsByOrder.get(id) || []

        list.push({
          productId: Number(row.product_id),
          name: row.name,
          quantity: Number(row.quantity),
          unitPrice: number(row.unit_price),
          subtotal: number(row.subtotal),
        })

        itemsByOrder.set(id, list)
      }

      orders = orderRows.rows.map((row) => ({
        id: Number(row.id),
        code: row.code,
        reference: row.reference,
        type: row.type,
        status: row.status,
        channel: row.channel,
        subtotal: number(row.subtotal),
        discount: number(row.discount),
        ...(row.coupon_code
          ? { couponCode: row.coupon_code }
          : {}),
        deliveryFee: number(row.delivery_fee),
        total: number(row.total),
        paymentStatus: row.payment_status,
        paymentMethod: row.payment_method,
        ...(row.change_for
          ? { changeFor: row.change_for }
          : {}),
        ...(row.notes
          ? { notes: row.notes }
          : {}),
        customer: row.customer || {},
        ...(row.courier_id !== null
          ? { courierId: Number(row.courier_id) }
          : {}),
        ...(row.courier_name
          ? { courierName: row.courier_name }
          : {}),
        ...(row.delivery_zone_id !== null
          ? { deliveryZoneId: Number(row.delivery_zone_id) }
          : {}),
        ...(row.delivery_zone_name
          ? { deliveryZoneName: row.delivery_zone_name }
          : {}),
        requestedFor: iso(row.requested_for),
        scheduled: bool(row.scheduled),
        ...(row.printed_at
          ? { printedAt: iso(row.printed_at) }
          : {}),
        items: itemsByOrder.get(Number(row.id)) || [],
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      }))
    }

    if (hasCustomers) {
      const accountRows = await client.query(
        `
          SELECT
            id,
            cpf_hash,
            cpf_last4,
            pin_hash,
            name,
            phone,
            email,
            default_address,
            default_number,
            default_district,
            default_city,
            default_state,
            default_zip_code,
            default_complement,
            default_latitude,
            default_longitude,
            loyalty_points,
            active,
            created_at,
            updated_at
          FROM sf_customer_accounts
          WHERE organization_id = $1
          ORDER BY id ASC
        `,
        [organization.id],
      )

      customerAccounts = accountRows.rows.map((row) => ({
        id: Number(row.id),
        cpfHash: row.cpf_hash,
        cpfLast4: row.cpf_last4,
        pinHash: row.pin_hash,
        name: row.name,
        phone: row.phone,
        email: row.email || "",
        defaultAddress: row.default_address || "",
        defaultNumber: row.default_number || "",
        defaultDistrict: row.default_district || "",
        defaultCity: row.default_city || "",
        defaultState: row.default_state || "",
        defaultZipCode: row.default_zip_code || "",
        defaultComplement: row.default_complement || "",
        defaultLatitude:
          row.default_latitude === null
            ? null
            : Number(row.default_latitude),
        defaultLongitude:
          row.default_longitude === null
            ? null
            : Number(row.default_longitude),
        loyaltyPoints: Number(row.loyalty_points),
        active: bool(row.active),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      }))
    }

    const sequence = {
      ...(store.sequence || {}),
      category: Math.max(
        0,
        ...categories.map((item) => Number(item.id) || 0),
      ),
      product: Math.max(
        0,
        ...products.map((item) => Number(item.id) || 0),
      ),
      order: Math.max(
        0,
        ...orders.map((item) => Number(item.id) || 0),
      ),
      customerAccount: Math.max(
        0,
        ...customerAccounts.map((item) => Number(item.id) || 0),
      ),
    }

    const finalStore = {
      ...store,
      categories,
      products,
      orders,
      customerAccounts,
      sequence,
    }

    let backupPath = null

    try {
      const existing = await fs.readFile(dataFile, "utf8")
      if (existing.trim()) {
        backupPath = `${dataFile}.backup-${Date.now()}`
        await fs.writeFile(backupPath, existing, "utf8")
      }
    } catch {
      // arquivo ainda não existe
    }

    const tempFile = `${dataFile}.${process.pid}.tmp`

    await fs.writeFile(
      tempFile,
      JSON.stringify(finalStore, null, 2),
      "utf8",
    )
    await fs.rename(tempFile, dataFile)

    console.log("")
    console.log(
      "SaborFlow - armazenamento persistente inicializado com sucesso.",
    )
    console.log(`Empresa: ${organization.trade_name}`)
    console.log(`Volume: ${volumeMount}`)
    console.log(`DATA_FILE: ${dataFile}`)
    console.log(`Base usada: ${baseFile}`)
    console.log(`Categorias restauradas do PostgreSQL: ${categories.length}`)
    console.log(`Produtos restaurados do PostgreSQL: ${products.length}`)
    console.log(`Pedidos restaurados do PostgreSQL: ${orders.length}`)
    console.log(
      `Contas restauradas do PostgreSQL: ${customerAccounts.length}`,
    )
    if (backupPath) {
      console.log(`Backup anterior: ${backupPath}`)
    }
    console.log("")
    console.log(
      "Agora reinicie/redeploy o serviço e confira os health checks.",
    )
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("Falha ao inicializar o armazenamento persistente:")
  console.error(error)
  process.exit(1)
})
