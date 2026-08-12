import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import type { Category, Product } from "@/lib/types"
import {
  getProductIngredientAvailability,
  getProductModifierGroupsForProducts,
} from "@/lib/food-composition-db"

type CategoryRow = {
  id: number
  name: string
  active: boolean
  sort_order: number
  created_at: Date | string
  updated_at: Date | string
}

type ProductRow = {
  id: number
  name: string
  description: string
  category: string
  price: string | number
  active: boolean
  featured: boolean
  image: string
  track_stock: boolean
  stock: number
  min_stock: number
  created_at: Date | string
  updated_at: Date | string
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: Number(row.id),
    name: row.name,
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function mapProduct(row: ProductRow): Product {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description || "",
    category: row.category,
    price: Number(row.price),
    active: Boolean(row.active),
    featured: Boolean(row.featured),
    image: row.image || "",
    trackStock: Boolean(row.track_stock),
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function databaseError(error: unknown, fallback: string) {
  const pgError = error as { code?: string }
  if (pgError?.code === "23505") {
    return new Error("Já existe um registro com esses dados nesta empresa.")
  }
  return error instanceof Error ? error : new Error(fallback)
}

async function lockTenantCatalog(client: PoolClient, organizationId: string) {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`saborflow-catalog:${organizationId}`],
  )
}

async function nextScopedId(
  client: PoolClient,
  table: "sf_categories" | "sf_products",
  organizationId: string,
) {
  const result = await client.query<{ next_id: number }>(
    `SELECT COALESCE(MAX(id), 0)::int + 1 AS next_id
     FROM ${table}
     WHERE organization_id = $1`,
    [organizationId],
  )

  return Number(result.rows[0]?.next_id || 1)
}

async function findCategoryByName(
  client: PoolClient,
  organizationId: string,
  name: string,
) {
  const result = await client.query<CategoryRow>(
    `
      SELECT id, name, active, sort_order, created_at, updated_at
      FROM sf_categories
      WHERE organization_id = $1
        AND lower(name) = lower($2)
      LIMIT 1
    `,
    [organizationId, name.trim()],
  )

  return result.rows[0] ?? null
}

async function createCategoryWithClient(
  client: PoolClient,
  organizationId: string,
  name: string,
) {
  const value = name.trim()
  if (!value) throw new Error("Informe o nome da categoria.")

  const existing = await findCategoryByName(client, organizationId, value)
  if (existing) return { category: mapCategory(existing), created: false }

  const id = await nextScopedId(client, "sf_categories", organizationId)
  const sortOrderResult = await client.query<{ next_sort: number }>(
    `
      SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_sort
      FROM sf_categories
      WHERE organization_id = $1
    `,
    [organizationId],
  )

  const inserted = await client.query<CategoryRow>(
    `
      INSERT INTO sf_categories (
        organization_id, id, name, active, sort_order
      )
      VALUES ($1, $2, $3, true, $4)
      RETURNING id, name, active, sort_order, created_at, updated_at
    `,
    [
      organizationId,
      id,
      value,
      Number(sortOrderResult.rows[0]?.next_sort || 1),
    ],
  )

  return {
    category: mapCategory(inserted.rows[0]),
    created: true,
  }
}

export async function isTenantCatalogReady(organizationId: string) {
  try {
    const result = await getPostgresPool().query<{ ready: boolean }>(
      `
        SELECT ready
        FROM sf_catalog_state
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

export async function getTenantCategories(
  organizationId: string,
  options?: { includeInactive?: boolean },
) {
  const result = await getPostgresPool().query<CategoryRow>(
    `
      SELECT id, name, active, sort_order, created_at, updated_at
      FROM sf_categories
      WHERE organization_id = $1
        ${options?.includeInactive ? "" : "AND active = true"}
      ORDER BY sort_order ASC, name ASC, id ASC
    `,
    [organizationId],
  )

  return result.rows.map(mapCategory)
}

export async function getTenantProducts(
  organizationId: string,
  options?: { includeInactive?: boolean },
): Promise<Product[]> {
  const result = await getPostgresPool().query<ProductRow>(
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
        ${options?.includeInactive ? "" : "AND p.active = true"}
      ORDER BY
        p.featured DESC,
        c.name ASC,
        p.name ASC,
        p.id ASC
    `,
    [organizationId],
  )

  const products = result.rows.map(mapProduct)
  const productIds = products.map((product) => product.id)

  const [modifierGroups, ingredientAvailability] = await Promise.all([
    getProductModifierGroupsForProducts(organizationId, productIds, {
      includeInactive: Boolean(options?.includeInactive),
    }),
    getProductIngredientAvailability(organizationId, productIds),
  ])

  return products.map((product) => {
    const groups = modifierGroups.get(product.id) || []
    const requiredModifiersAvailable = groups
      .filter((group) => group.active)
      .every((group) => {
        const minimum = Math.max(group.required ? 1 : 0, group.minSelect)
        if (minimum <= 0) return true
        return group.options.filter((option) => option.active && option.available).length >= minimum
      })

    return {
      ...product,
      modifierGroups: groups,
      ingredientStockAvailable:
        ingredientAvailability.get(product.id) !== false && requiredModifiersAvailable,
    }
  })
}

export async function createTenantCategory(
  organizationId: string,
  name: string,
) {
  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await lockTenantCatalog(client, organizationId)

    const result = await createCategoryWithClient(
      client,
      organizationId,
      name,
    )

    if (!result.created) {
      throw new Error("Essa categoria já existe.")
    }

    await client.query("COMMIT")
    return result.category
  } catch (error) {
    await client.query("ROLLBACK")
    throw databaseError(error, "Não foi possível criar a categoria.")
  } finally {
    client.release()
  }
}

export async function updateTenantCategory(
  organizationId: string,
  id: number,
  patch: Partial<Pick<Category, "name" | "active" | "sortOrder">>,
) {
  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await lockTenantCatalog(client, organizationId)

    const currentResult = await client.query<CategoryRow>(
      `
        SELECT id, name, active, sort_order, created_at, updated_at
        FROM sf_categories
        WHERE organization_id = $1 AND id = $2
        LIMIT 1
      `,
      [organizationId, id],
    )

    const current = currentResult.rows[0]
    if (!current) {
      await client.query("ROLLBACK")
      return null
    }

    const previousName = current.name
    const nextName =
      patch.name !== undefined
        ? patch.name.trim() || current.name
        : current.name
    const nextActive =
      patch.active !== undefined ? Boolean(patch.active) : current.active
    const nextSortOrder =
      patch.sortOrder !== undefined
        ? Math.max(0, Math.floor(Number(patch.sortOrder)))
        : Number(current.sort_order)

    const updated = await client.query<CategoryRow>(
      `
        UPDATE sf_categories
        SET
          name = $3,
          active = $4,
          sort_order = $5,
          updated_at = now()
        WHERE organization_id = $1 AND id = $2
        RETURNING id, name, active, sort_order, created_at, updated_at
      `,
      [organizationId, id, nextName, nextActive, nextSortOrder],
    )

    await client.query("COMMIT")

    return {
      category: mapCategory(updated.rows[0]),
      previousName,
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw databaseError(error, "Não foi possível atualizar a categoria.")
  } finally {
    client.release()
  }
}

export async function createTenantProduct(
  organizationId: string,
  input: {
    name: string
    description: string
    category: string
    price: number
    image?: string
    featured?: boolean
    trackStock?: boolean
    stock?: number
    minStock?: number
  },
) {
  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await lockTenantCatalog(client, organizationId)

    const categoryResult = await createCategoryWithClient(
      client,
      organizationId,
      input.category,
    )

    const id = await nextScopedId(client, "sf_products", organizationId)
    const name = input.name.trim()
    const price = Number(Number(input.price).toFixed(2))

    if (!name || !Number.isFinite(price) || price < 0) {
      throw new Error("Dados do produto inválidos.")
    }

    const inserted = await client.query<ProductRow>(
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
          min_stock
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          true, $7, $8, $9, $10, $11
        )
        RETURNING
          id,
          name,
          description,
          $12::text AS category,
          price,
          active,
          featured,
          image,
          track_stock,
          stock,
          min_stock,
          created_at,
          updated_at
      `,
      [
        organizationId,
        id,
        categoryResult.category.id,
        name,
        input.description.trim(),
        price,
        Boolean(input.featured),
        input.image?.trim() || "",
        Boolean(input.trackStock),
        Math.max(0, Math.floor(Number(input.stock || 0))),
        Math.max(0, Math.floor(Number(input.minStock || 0))),
        categoryResult.category.name,
      ],
    )

    await client.query("COMMIT")

    return {
      product: mapProduct(inserted.rows[0]),
      createdCategory: categoryResult.created
        ? categoryResult.category
        : null,
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw databaseError(error, "Não foi possível criar o produto.")
  } finally {
    client.release()
  }
}

export async function updateTenantProduct(
  organizationId: string,
  id: number,
  patch: Partial<
    Pick<
      Product,
      | "name"
      | "description"
      | "category"
      | "price"
      | "active"
      | "featured"
      | "image"
      | "trackStock"
      | "stock"
      | "minStock"
    >
  >,
) {
  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await lockTenantCatalog(client, organizationId)

    const currentResult = await client.query<ProductRow & { category_id: number }>(
      `
        SELECT
          p.id,
          p.category_id,
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
        WHERE p.organization_id = $1 AND p.id = $2
        LIMIT 1
      `,
      [organizationId, id],
    )

    const current = currentResult.rows[0]
    if (!current) {
      await client.query("ROLLBACK")
      return null
    }

    let categoryId = Number(current.category_id)
    let categoryName = current.category
    let createdCategory: Category | null = null

    if (patch.category !== undefined) {
      const categoryResult = await createCategoryWithClient(
        client,
        organizationId,
        patch.category,
      )
      categoryId = categoryResult.category.id
      categoryName = categoryResult.category.name
      createdCategory = categoryResult.created
        ? categoryResult.category
        : null
    }

    const name =
      patch.name !== undefined ? patch.name.trim() : current.name
    const description =
      patch.description !== undefined
        ? patch.description.trim()
        : current.description
    const price =
      patch.price !== undefined
        ? Number(Number(patch.price).toFixed(2))
        : Number(current.price)

    if (!name || !Number.isFinite(price) || price < 0) {
      throw new Error("Dados do produto inválidos.")
    }

    const updated = await client.query<ProductRow>(
      `
        UPDATE sf_products
        SET
          category_id = $3,
          name = $4,
          description = $5,
          price = $6,
          active = $7,
          featured = $8,
          image = $9,
          track_stock = $10,
          stock = $11,
          min_stock = $12,
          updated_at = now()
        WHERE organization_id = $1 AND id = $2
        RETURNING
          id,
          name,
          description,
          $13::text AS category,
          price,
          active,
          featured,
          image,
          track_stock,
          stock,
          min_stock,
          created_at,
          updated_at
      `,
      [
        organizationId,
        id,
        categoryId,
        name,
        description,
        price,
        patch.active !== undefined
          ? Boolean(patch.active)
          : current.active,
        patch.featured !== undefined
          ? Boolean(patch.featured)
          : current.featured,
        patch.image !== undefined
          ? patch.image.trim()
          : current.image,
        patch.trackStock !== undefined
          ? Boolean(patch.trackStock)
          : current.track_stock,
        patch.stock !== undefined
          ? Math.max(0, Math.floor(Number(patch.stock)))
          : Number(current.stock),
        patch.minStock !== undefined
          ? Math.max(0, Math.floor(Number(patch.minStock)))
          : Number(current.min_stock),
        categoryName,
      ],
    )

    await client.query("COMMIT")

    return {
      product: mapProduct(updated.rows[0]),
      createdCategory,
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw databaseError(error, "Não foi possível atualizar o produto.")
  } finally {
    client.release()
  }
}

export async function deactivateTenantProduct(
  organizationId: string,
  id: number,
) {
  const result = await getPostgresPool().query<ProductRow>(
    `
      UPDATE sf_products p
      SET active = false, updated_at = now()
      FROM sf_categories c
      WHERE p.organization_id = $1
        AND p.id = $2
        AND c.organization_id = p.organization_id
        AND c.id = p.category_id
      RETURNING
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
    `,
    [organizationId, id],
  )

  return result.rows[0] ? mapProduct(result.rows[0]) : null
}

export async function getCurrentDeploymentOrganizationId() {
  const email = (process.env.ADMIN_EMAIL || "").trim()
  if (!email) return null

  try {
    const result = await getPostgresPool().query<{ organization_id: string }>(
      `
        SELECT m.organization_id
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
      [email],
    )

    return result.rows[0]?.organization_id ?? null
  } catch {
    return null
  }
}

export async function isCurrentDeploymentOrganization(
  organizationId: string,
) {
  const current = await getCurrentDeploymentOrganizationId()
  return Boolean(current && current === organizationId)
}

export async function syncCurrentDeploymentProductStocks(
  products: Array<Pick<Product, "id" | "stock">>,
) {
  if (!process.env.DATABASE_URL || !products.length) return

  const organizationId = await getCurrentDeploymentOrganizationId()
  if (!organizationId) return

  if (!(await isTenantCatalogReady(organizationId))) return

  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")

    for (const product of products) {
      await client.query(
        `
          UPDATE sf_products
          SET stock = $3, updated_at = now()
          WHERE organization_id = $1 AND id = $2
        `,
        [
          organizationId,
          product.id,
          Math.max(0, Math.floor(Number(product.stock))),
        ],
      )
    }

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function getTenantCatalogStats(organizationId: string) {
  const [state, categories, products] = await Promise.all([
    getPostgresPool().query<{
      ready: boolean
      source: string | null
      categories_count: number
      products_count: number
      imported_at: Date | string | null
    }>(
      `
        SELECT
          ready,
          source,
          categories_count,
          products_count,
          imported_at
        FROM sf_catalog_state
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organizationId],
    ),
    getPostgresPool().query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM sf_categories
        WHERE organization_id = $1
      `,
      [organizationId],
    ),
    getPostgresPool().query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM sf_products
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
    categories: Number(categories.rows[0]?.count || 0),
    products: Number(products.rows[0]?.count || 0),
    importedCategories: Number(row?.categories_count || 0),
    importedProducts: Number(row?.products_count || 0),
  }
}
