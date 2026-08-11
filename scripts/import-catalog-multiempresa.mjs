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

function positiveInt(value, fallback) {
  const parsed = Math.floor(Number(value))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function validDate(value) {
  const date = new Date(value || "")
  return Number.isNaN(date.getTime()) ? new Date() : date
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  connectionTimeoutMillis: 10000,
})

async function main() {
  const { file, store } = await readStore()
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
          AND table_name = 'sf_catalog_state'
      `,
    )

    if (!schemaResult.rowCount) {
      throw new Error(
        "Migration 003 ainda não foi aplicada. Rode node scripts/migrate-multiempresa.mjs primeiro.",
      )
    }

    const existingState = await client.query(
      `
        SELECT ready, imported_at, categories_count, products_count
        FROM sf_catalog_state
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organization.id],
    )

    if (existingState.rows[0]?.ready && !force) {
      console.log("")
      console.log("Catálogo já foi importado para esta organização.")
      console.log(`Empresa: ${organization.trade_name}`)
      console.log(
        `Categorias: ${existingState.rows[0].categories_count}`,
      )
      console.log(
        `Produtos: ${existingState.rows[0].products_count}`,
      )
      console.log("")
      console.log(
        "Nada foi alterado. Não use --force sem necessidade.",
      )
      return
    }

    const sourceCategories = Array.isArray(store.categories)
      ? store.categories
      : []
    const sourceProducts = Array.isArray(store.products)
      ? store.products
      : []

    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`saborflow-catalog:${organization.id}`],
    )

    // Só substitui o catálogo da organização alvo. Nenhuma outra empresa
    // é tocada. O store.json também não é modificado.
    await client.query(
      "DELETE FROM sf_products WHERE organization_id = $1",
      [organization.id],
    )
    await client.query(
      "DELETE FROM sf_categories WHERE organization_id = $1",
      [organization.id],
    )

    const categoryByName = new Map()
    const usedCategoryIds = new Set()
    let nextCategoryId = 1

    async function insertCategory(source) {
      const name = String(source?.name || "").trim()
      if (!name) return null

      const key = name.toLocaleLowerCase("pt-BR")
      if (categoryByName.has(key)) return categoryByName.get(key)

      let id = positiveInt(source?.id, nextCategoryId)
      while (usedCategoryIds.has(id)) id += 1
      usedCategoryIds.add(id)
      nextCategoryId = Math.max(nextCategoryId, id + 1)

      const category = {
        id,
        name,
        active: source?.active ?? true,
        sortOrder: Math.max(
          0,
          Math.floor(Number(source?.sortOrder ?? categoryByName.size + 1)),
        ),
        createdAt: validDate(source?.createdAt),
        updatedAt: validDate(source?.updatedAt),
      }

      await client.query(
        `
          INSERT INTO sf_categories (
            organization_id,
            id,
            name,
            active,
            sort_order,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          organization.id,
          category.id,
          category.name,
          category.active,
          category.sortOrder,
          category.createdAt,
          category.updatedAt,
        ],
      )

      categoryByName.set(key, category)
      return category
    }

    for (const category of sourceCategories) {
      await insertCategory(category)
    }

    for (const product of sourceProducts) {
      const categoryName = String(product?.category || "").trim()
      if (!categoryName) continue

      if (!categoryByName.has(categoryName.toLocaleLowerCase("pt-BR"))) {
        await insertCategory({
          name: categoryName,
          active: true,
          sortOrder: categoryByName.size + 1,
        })
      }
    }

    const usedProductIds = new Set()
    let nextProductId = 1
    let productCount = 0

    for (const source of sourceProducts) {
      const name = String(source?.name || "").trim()
      const categoryName = String(source?.category || "").trim()
      if (!name || !categoryName) continue

      const category = categoryByName.get(
        categoryName.toLocaleLowerCase("pt-BR"),
      )
      if (!category) continue

      let id = positiveInt(source?.id, nextProductId)
      while (usedProductIds.has(id)) id += 1
      usedProductIds.add(id)
      nextProductId = Math.max(nextProductId, id + 1)

      const price = Math.max(0, Number(source?.price || 0))

      await client.query(
        `
          INSERT INTO sf_products (
            organization_id,
            id,
            category_id,
            name,
            description,
            price,
            active,
            featured,
            image,
            track_stock,
            stock,
            min_stock,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14
          )
        `,
        [
          organization.id,
          id,
          category.id,
          name,
          String(source?.description || ""),
          Number.isFinite(price) ? price : 0,
          source?.active ?? true,
          Boolean(source?.featured),
          String(source?.image || ""),
          Boolean(source?.trackStock),
          Math.max(0, Math.floor(Number(source?.stock || 0))),
          Math.max(0, Math.floor(Number(source?.minStock || 0))),
          validDate(source?.createdAt),
          validDate(source?.updatedAt),
        ],
      )

      productCount += 1
    }

    await client.query(
      `
        INSERT INTO sf_catalog_state (
          organization_id,
          ready,
          source,
          categories_count,
          products_count,
          imported_at,
          updated_at
        )
        VALUES ($1, true, $2, $3, $4, now(), now())
        ON CONFLICT (organization_id)
        DO UPDATE SET
          ready = true,
          source = EXCLUDED.source,
          categories_count = EXCLUDED.categories_count,
          products_count = EXCLUDED.products_count,
          imported_at = now(),
          updated_at = now()
      `,
      [
        organization.id,
        file,
        categoryByName.size,
        productCount,
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
          'catalog.import',
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
          categories: categoryByName.size,
          products: productCount,
          forced: force,
        }),
        adminEmail,
      ],
    )

    await client.query("COMMIT")

    console.log("")
    console.log("SaborFlow - catálogo multiempresa importado com sucesso.")
    console.log(`Empresa: ${organization.trade_name}`)
    console.log(`Slug: ${organization.slug}`)
    console.log(`Organization ID: ${organization.id}`)
    console.log(`Categorias: ${categoryByName.size}`)
    console.log(`Produtos: ${productCount}`)
    console.log(`Origem: ${file}`)
    console.log("")
    console.log("store.json não foi apagado nem alterado.")
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
  console.error("Falha na importação do catálogo:")
  console.error(error)
  process.exit(1)
})
