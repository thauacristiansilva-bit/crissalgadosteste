import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import type {
  Ingredient,
  IngredientUnit,
  InventoryMovement,
  ProductComposition,
  ProductModifierGroup,
  ProductModifierOptionIngredient,
  ProductRecipeItem,
} from "@/lib/types"

const allowedUnits = new Set<IngredientUnit>([
  "g",
  "kg",
  "ml",
  "l",
  "unit",
  "portion",
])

type IngredientRow = {
  id: number
  name: string
  unit: IngredientUnit
  stock_quantity: string | number
  min_stock_quantity: string | number
  unit_cost: string | number
  active: boolean
  created_at: Date | string
  updated_at: Date | string
}

type ModifierGroupRow = {
  product_id: number
  id: number
  name: string
  description: string
  required: boolean
  min_select: number
  max_select: number
  included_quantity: number
  active: boolean
  sort_order: number
}

type ModifierOptionRow = {
  group_id: number
  id: number
  name: string
  description: string
  price_delta: string | number
  included_eligible: boolean
  active: boolean
  sort_order: number
}

type IngredientLinkRow = {
  owner_id: number
  ingredient_id: number
  ingredient_name: string
  unit: IngredientUnit
  quantity: string | number
  unit_cost: string | number
  stock_quantity: string | number
  ingredient_active: boolean
}

export type ProductCompositionInput = {
  modifierGroups?: Array<{
    name?: string
    description?: string
    required?: boolean
    minSelect?: number
    maxSelect?: number
    includedQuantity?: number
    active?: boolean
    sortOrder?: number
    options?: Array<{
      name?: string
      description?: string
      priceDelta?: number
      includedEligible?: boolean
      active?: boolean
      sortOrder?: number
      ingredients?: Array<{
        ingredientId?: number
        quantity?: number
      }>
    }>
  }>
  recipe?: Array<{
    ingredientId?: number
    quantity?: number
  }>
}

export type IngredientMovementInput = {
  kind: "manual_in" | "manual_out" | "adjustment" | "waste"
  quantity: number
  note?: string
}

export type CheckoutIngredientLine = {
  productId: number
  quantity: number
  optionIds: number[]
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function roundQuantity(value: number) {
  return Number(Number(value).toFixed(3))
}

function roundCost(value: number) {
  return Number(Number(value).toFixed(4))
}

function mapIngredient(row: IngredientRow): Ingredient {
  return {
    id: Number(row.id),
    name: row.name,
    unit: row.unit,
    stockQuantity: Number(row.stock_quantity),
    minStockQuantity: Number(row.min_stock_quantity),
    unitCost: Number(row.unit_cost),
    active: Boolean(row.active),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function missingFoodTables(error: unknown) {
  const code = (error as { code?: string })?.code
  return code === "42P01" || code === "42703"
}

async function lockFoodCatalog(client: PoolClient, organizationId: string) {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`saborflow-food-composition:${organizationId}`],
  )
}

async function nextScopedId(
  client: PoolClient,
  table: "sf_ingredients" | "sf_modifier_groups" | "sf_modifier_options",
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

async function refreshFoodStateWithClient(
  client: PoolClient,
  organizationId: string,
  source = "app",
) {
  await client.query(
    `
      INSERT INTO sf_food_composition_state (
        organization_id,
        ready,
        source,
        modifier_groups_count,
        modifier_options_count,
        ingredients_count,
        recipe_items_count,
        imported_at,
        updated_at
      )
      VALUES (
        $1,
        true,
        $2,
        (SELECT COUNT(*)::int FROM sf_modifier_groups WHERE organization_id = $1),
        (SELECT COUNT(*)::int FROM sf_modifier_options WHERE organization_id = $1),
        (SELECT COUNT(*)::int FROM sf_ingredients WHERE organization_id = $1),
        (
          (SELECT COUNT(*)::int FROM sf_product_ingredients WHERE organization_id = $1) +
          (SELECT COUNT(*)::int FROM sf_modifier_option_ingredients WHERE organization_id = $1)
        ),
        now(),
        now()
      )
      ON CONFLICT (organization_id)
      DO UPDATE SET
        ready = true,
        source = EXCLUDED.source,
        modifier_groups_count = EXCLUDED.modifier_groups_count,
        modifier_options_count = EXCLUDED.modifier_options_count,
        ingredients_count = EXCLUDED.ingredients_count,
        recipe_items_count = EXCLUDED.recipe_items_count,
        updated_at = now()
    `,
    [organizationId, source],
  )
}

export async function isTenantFoodCompositionReady(organizationId: string) {
  try {
    const result = await getPostgresPool().query<{ ready: boolean }>(
      `SELECT ready FROM sf_food_composition_state WHERE organization_id = $1 LIMIT 1`,
      [organizationId],
    )
    return Boolean(result.rows[0]?.ready)
  } catch (error) {
    if (missingFoodTables(error)) return false
    throw error
  }
}

export async function getTenantIngredients(
  organizationId: string,
  options?: { includeInactive?: boolean },
) {
  try {
    const result = await getPostgresPool().query<IngredientRow>(
      `
        SELECT
          id,
          name,
          unit,
          stock_quantity,
          min_stock_quantity,
          unit_cost,
          active,
          created_at,
          updated_at
        FROM sf_ingredients
        WHERE organization_id = $1
          ${options?.includeInactive ? "" : "AND active = true"}
        ORDER BY active DESC, name ASC, id ASC
      `,
      [organizationId],
    )
    return result.rows.map(mapIngredient)
  } catch (error) {
    if (missingFoodTables(error)) return []
    throw error
  }
}

export async function createTenantIngredient(
  organizationId: string,
  input: {
    name: string
    unit: IngredientUnit
    stockQuantity?: number
    minStockQuantity?: number
    unitCost?: number
  },
) {
  const name = input.name.trim()
  const unit = input.unit
  const rawStockQuantity = Number(input.stockQuantity ?? 0)
  const rawMinStockQuantity = Number(input.minStockQuantity ?? 0)
  const rawUnitCost = Number(input.unitCost ?? 0)

  if (!name) throw new Error("Informe o nome do ingrediente.")
  if (!allowedUnits.has(unit)) throw new Error("Unidade do ingrediente inválida.")
  if (![rawStockQuantity, rawMinStockQuantity, rawUnitCost].every(Number.isFinite)) {
    throw new Error("Estoque ou custo do ingrediente inválido.")
  }
  if (rawStockQuantity < 0 || rawMinStockQuantity < 0 || rawUnitCost < 0) {
    throw new Error("Estoque mínimo, saldo e custo não podem ser negativos.")
  }

  const stockQuantity = roundQuantity(rawStockQuantity)
  const minStockQuantity = roundQuantity(rawMinStockQuantity)
  const unitCost = roundCost(rawUnitCost)

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await lockFoodCatalog(client, organizationId)
    const id = await nextScopedId(client, "sf_ingredients", organizationId)
    const result = await client.query<IngredientRow>(
      `
        INSERT INTO sf_ingredients (
          organization_id,
          id,
          name,
          unit,
          stock_quantity,
          min_stock_quantity,
          unit_cost,
          active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING
          id,
          name,
          unit,
          stock_quantity,
          min_stock_quantity,
          unit_cost,
          active,
          created_at,
          updated_at
      `,
      [organizationId, id, name, unit, stockQuantity, minStockQuantity, unitCost],
    )
    if (stockQuantity > 0) {
      await client.query(
        `
          INSERT INTO sf_inventory_movements (
            organization_id, ingredient_id, kind, quantity_delta,
            unit_cost_snapshot, note
          )
          VALUES ($1, $2, 'adjustment', $3, $4, 'Saldo inicial do ingrediente')
        `,
        [organizationId, id, stockQuantity, unitCost],
      )
    }

    await refreshFoodStateWithClient(client, organizationId, "ingredient-create")
    await client.query("COMMIT")
    return mapIngredient(result.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    const pgError = error as { code?: string }
    if (pgError?.code === "23505") {
      throw new Error("Já existe um ingrediente com esse nome nesta empresa.")
    }
    throw error
  } finally {
    client.release()
  }
}

export async function updateTenantIngredient(
  organizationId: string,
  id: number,
  patch: Partial<Pick<Ingredient, "name" | "unit" | "minStockQuantity" | "unitCost" | "active">>,
) {
  const current = await getPostgresPool().query<IngredientRow>(
    `
      SELECT id, name, unit, stock_quantity, min_stock_quantity, unit_cost, active, created_at, updated_at
      FROM sf_ingredients
      WHERE organization_id = $1 AND id = $2
      LIMIT 1
    `,
    [organizationId, id],
  )
  const row = current.rows[0]
  if (!row) return null

  const name = patch.name !== undefined ? patch.name.trim() : row.name
  const unit = patch.unit !== undefined ? patch.unit : row.unit
  const rawMinStockQuantity = patch.minStockQuantity !== undefined
    ? Number(patch.minStockQuantity)
    : Number(row.min_stock_quantity)
  const rawUnitCost = patch.unitCost !== undefined
    ? Number(patch.unitCost)
    : Number(row.unit_cost)

  if (!name) throw new Error("Informe o nome do ingrediente.")
  if (!allowedUnits.has(unit)) throw new Error("Unidade do ingrediente inválida.")
  if (!Number.isFinite(rawMinStockQuantity) || rawMinStockQuantity < 0) {
    throw new Error("Estoque mínimo inválido.")
  }
  if (!Number.isFinite(rawUnitCost) || rawUnitCost < 0) {
    throw new Error("Custo do ingrediente inválido.")
  }

  if (unit !== row.unit) {
    const usage = await getPostgresPool().query<{ used: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1 FROM sf_product_ingredients
          WHERE organization_id = $1 AND ingredient_id = $2
          UNION ALL
          SELECT 1 FROM sf_modifier_option_ingredients
          WHERE organization_id = $1 AND ingredient_id = $2
        ) AS used
      `,
      [organizationId, id],
    )
    if (usage.rows[0]?.used) {
      throw new Error(
        "Não altere a unidade de um ingrediente já usado em ficha técnica. Crie outro ingrediente com a unidade correta.",
      )
    }
  }

  const minStockQuantity = roundQuantity(rawMinStockQuantity)
  const unitCost = roundCost(rawUnitCost)

  const result = await getPostgresPool().query<IngredientRow>(
    `
      UPDATE sf_ingredients
      SET
        name = $3,
        unit = $4,
        min_stock_quantity = $5,
        unit_cost = $6,
        active = $7,
        updated_at = now()
      WHERE organization_id = $1 AND id = $2
      RETURNING id, name, unit, stock_quantity, min_stock_quantity, unit_cost, active, created_at, updated_at
    `,
    [
      organizationId,
      id,
      name,
      unit,
      minStockQuantity,
      unitCost,
      patch.active !== undefined ? Boolean(patch.active) : row.active,
    ],
  )
  return result.rows[0] ? mapIngredient(result.rows[0]) : null
}

export async function moveTenantIngredientStock(
  organizationId: string,
  id: number,
  input: IngredientMovementInput,
) {
  const quantity = roundQuantity(Number(input.quantity))
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Informe uma quantidade válida.")
  }
  if (input.kind !== "adjustment" && quantity <= 0) {
    throw new Error("Informe uma quantidade maior que zero.")
  }

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await lockFoodCatalog(client, organizationId)
    const result = await client.query<IngredientRow>(
      `
        SELECT id, name, unit, stock_quantity, min_stock_quantity, unit_cost, active, created_at, updated_at
        FROM sf_ingredients
        WHERE organization_id = $1 AND id = $2
        FOR UPDATE
      `,
      [organizationId, id],
    )
    const row = result.rows[0]
    if (!row) {
      await client.query("ROLLBACK")
      return null
    }

    const current = Number(row.stock_quantity)
    let delta = 0
    if (input.kind === "manual_in") delta = quantity
    if (input.kind === "manual_out" || input.kind === "waste") delta = -quantity
    if (input.kind === "adjustment") delta = roundQuantity(quantity - current)

    if (delta === 0) {
      await client.query("COMMIT")
      return mapIngredient(row)
    }

    if (current + delta < 0) {
      throw new Error("A movimentação deixaria o estoque do ingrediente negativo.")
    }

    const updated = await client.query<IngredientRow>(
      `
        UPDATE sf_ingredients
        SET stock_quantity = stock_quantity + $3, updated_at = now()
        WHERE organization_id = $1 AND id = $2
        RETURNING id, name, unit, stock_quantity, min_stock_quantity, unit_cost, active, created_at, updated_at
      `,
      [organizationId, id, delta],
    )

    await client.query(
      `
        INSERT INTO sf_inventory_movements (
          organization_id,
          ingredient_id,
          kind,
          quantity_delta,
          unit_cost_snapshot,
          note
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [organizationId, id, input.kind, delta, Number(row.unit_cost), input.note?.trim() || ""],
    )

    await client.query("COMMIT")
    return mapIngredient(updated.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

async function getModifierGroupsForProductsWithClient(
  client: PoolClient,
  organizationId: string,
  productIds: number[],
  options?: { includeInactive?: boolean; includeIngredientDetails?: boolean },
) {
  const map = new Map<number, ProductModifierGroup[]>()
  if (!productIds.length) return map

  const groups = await client.query<ModifierGroupRow>(
    `
      SELECT
        pmg.product_id,
        g.id,
        g.name,
        g.description,
        g.required,
        g.min_select,
        g.max_select,
        g.included_quantity,
        g.active,
        pmg.sort_order
      FROM sf_product_modifier_groups pmg
      INNER JOIN sf_modifier_groups g
        ON g.organization_id = pmg.organization_id
       AND g.id = pmg.group_id
      WHERE pmg.organization_id = $1
        AND pmg.product_id = ANY($2::int[])
        ${options?.includeInactive ? "" : "AND g.active = true"}
      ORDER BY pmg.product_id ASC, pmg.sort_order ASC, g.id ASC
    `,
    [organizationId, productIds],
  )

  const groupIds = groups.rows.map((row) => Number(row.id))
  if (!groupIds.length) {
    productIds.forEach((id) => map.set(id, []))
    return map
  }

  const optionResult = await client.query<ModifierOptionRow>(
    `
      SELECT
        group_id,
        id,
        name,
        description,
        price_delta,
        included_eligible,
        active,
        sort_order
      FROM sf_modifier_options
      WHERE organization_id = $1
        AND group_id = ANY($2::int[])
        ${options?.includeInactive ? "" : "AND active = true"}
      ORDER BY group_id ASC, sort_order ASC, id ASC
    `,
    [organizationId, groupIds],
  )

  const optionIds = optionResult.rows.map((row) => Number(row.id))
  const ingredientLinks = optionIds.length
    ? await client.query<IngredientLinkRow>(
        `
          SELECT
            moi.option_id AS owner_id,
            i.id AS ingredient_id,
            i.name AS ingredient_name,
            i.unit,
            moi.quantity,
            i.unit_cost,
            i.stock_quantity,
            i.active AS ingredient_active
          FROM sf_modifier_option_ingredients moi
          INNER JOIN sf_ingredients i
            ON i.organization_id = moi.organization_id
           AND i.id = moi.ingredient_id
          WHERE moi.organization_id = $1
            AND moi.option_id = ANY($2::int[])
          ORDER BY moi.option_id ASC, i.name ASC, i.id ASC
        `,
        [organizationId, optionIds],
      )
    : { rows: [] as IngredientLinkRow[] }

  const linksByOption = new Map<number, IngredientLinkRow[]>()
  for (const link of ingredientLinks.rows) {
    const list = linksByOption.get(Number(link.owner_id)) || []
    list.push(link)
    linksByOption.set(Number(link.owner_id), list)
  }

  const optionsByGroup = new Map<number, ProductModifierGroup["options"]>()
  for (const option of optionResult.rows) {
    const links = linksByOption.get(Number(option.id)) || []
    const available = links.every(
      (link) =>
        Boolean(link.ingredient_active) &&
        Number(link.stock_quantity) >= Number(link.quantity),
    )
    const ingredients: ProductModifierOptionIngredient[] = links.map((link) => ({
      ingredientId: Number(link.ingredient_id),
      ingredientName: link.ingredient_name,
      unit: link.unit,
      quantity: Number(link.quantity),
      unitCost: Number(link.unit_cost),
      estimatedCost: roundCost(Number(link.quantity) * Number(link.unit_cost)),
    }))
    const mapped = {
      id: Number(option.id),
      name: option.name,
      description: option.description || "",
      priceDelta: Number(option.price_delta),
      includedEligible: Boolean(option.included_eligible),
      active: Boolean(option.active),
      sortOrder: Number(option.sort_order),
      available,
      ...(options?.includeIngredientDetails
        ? {
            estimatedFoodCost: roundCost(
              ingredients.reduce((sum, item) => sum + item.estimatedCost, 0),
            ),
            ingredients,
          }
        : {}),
    }
    const list = optionsByGroup.get(Number(option.group_id)) || []
    list.push(mapped)
    optionsByGroup.set(Number(option.group_id), list)
  }

  for (const group of groups.rows) {
    const mapped: ProductModifierGroup = {
      id: Number(group.id),
      name: group.name,
      description: group.description || "",
      required: Boolean(group.required),
      minSelect: Number(group.min_select),
      maxSelect: Number(group.max_select),
      includedQuantity: Number(group.included_quantity),
      active: Boolean(group.active),
      sortOrder: Number(group.sort_order),
      options: optionsByGroup.get(Number(group.id)) || [],
    }
    const list = map.get(Number(group.product_id)) || []
    list.push(mapped)
    map.set(Number(group.product_id), list)
  }

  productIds.forEach((id) => {
    if (!map.has(id)) map.set(id, [])
  })
  return map
}

export async function getProductModifierGroupsForProducts(
  organizationId: string,
  productIds: number[],
  options?: { includeInactive?: boolean },
) {
  if (!productIds.length) return new Map<number, ProductModifierGroup[]>()
  const client = await getPostgresPool().connect()
  try {
    return await getModifierGroupsForProductsWithClient(
      client,
      organizationId,
      productIds,
      options,
    )
  } catch (error) {
    if (missingFoodTables(error)) return new Map<number, ProductModifierGroup[]>()
    throw error
  } finally {
    client.release()
  }
}

export { getModifierGroupsForProductsWithClient }

async function productRecipeWithClient(
  client: PoolClient,
  organizationId: string,
  productId: number,
): Promise<ProductRecipeItem[]> {
  const result = await client.query<IngredientLinkRow>(
    `
      SELECT
        pi.product_id AS owner_id,
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        i.unit,
        pi.quantity,
        i.unit_cost,
        i.stock_quantity,
        i.active AS ingredient_active
      FROM sf_product_ingredients pi
      INNER JOIN sf_ingredients i
        ON i.organization_id = pi.organization_id
       AND i.id = pi.ingredient_id
      WHERE pi.organization_id = $1
        AND pi.product_id = $2
      ORDER BY i.name ASC, i.id ASC
    `,
    [organizationId, productId],
  )
  return result.rows.map((row) => ({
    ingredientId: Number(row.ingredient_id),
    ingredientName: row.ingredient_name,
    unit: row.unit,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
    estimatedCost: roundCost(Number(row.quantity) * Number(row.unit_cost)),
  }))
}

export async function getProductIngredientAvailability(
  organizationId: string,
  productIds: number[],
) {
  const map = new Map<number, boolean>()
  if (!productIds.length) return map
  try {
    const result = await getPostgresPool().query<{
      product_id: number
      available: boolean
    }>(
      `
        SELECT
          p.id AS product_id,
          NOT EXISTS (
            SELECT 1
            FROM sf_product_ingredients pi
            INNER JOIN sf_ingredients i
              ON i.organization_id = pi.organization_id
             AND i.id = pi.ingredient_id
            WHERE pi.organization_id = p.organization_id
              AND pi.product_id = p.id
              AND (
                i.active = false OR
                i.stock_quantity < pi.quantity
              )
          ) AS available
        FROM sf_products p
        WHERE p.organization_id = $1
          AND p.id = ANY($2::int[])
      `,
      [organizationId, productIds],
    )
    result.rows.forEach((row) => map.set(Number(row.product_id), Boolean(row.available)))
    productIds.forEach((id) => {
      if (!map.has(id)) map.set(id, true)
    })
    return map
  } catch (error) {
    if (missingFoodTables(error)) {
      productIds.forEach((id) => map.set(id, true))
      return map
    }
    throw error
  }
}

export async function getProductComposition(
  organizationId: string,
  productId: number,
): Promise<ProductComposition | null> {
  const product = await getPostgresPool().query<{ id: number }>(
    `SELECT id FROM sf_products WHERE organization_id = $1 AND id = $2 LIMIT 1`,
    [organizationId, productId],
  )
  if (!product.rows[0]) return null

  const client = await getPostgresPool().connect()
  try {
    const groups = await getModifierGroupsForProductsWithClient(
      client,
      organizationId,
      [productId],
      { includeInactive: true, includeIngredientDetails: true },
    )
    const recipe = await productRecipeWithClient(client, organizationId, productId)
    const availability = await client.query<{ available: boolean }>(
      `
        SELECT NOT EXISTS (
          SELECT 1
          FROM sf_product_ingredients pi
          INNER JOIN sf_ingredients i
            ON i.organization_id = pi.organization_id
           AND i.id = pi.ingredient_id
          WHERE pi.organization_id = $1
            AND pi.product_id = $2
            AND (i.active = false OR i.stock_quantity < pi.quantity)
        ) AS available
      `,
      [organizationId, productId],
    )
    return {
      productId,
      modifierGroups: groups.get(productId) || [],
      recipe,
      estimatedFoodCost: roundCost(
        recipe.reduce((sum, item) => sum + item.estimatedCost, 0),
      ),
      ingredientStockAvailable: Boolean(availability.rows[0]?.available ?? true),
    }
  } finally {
    client.release()
  }
}

function normalizeComposition(input: ProductCompositionInput) {
  const rawRecipe = input.recipe || []
  const rawGroups = input.modifierGroups || []

  if (rawRecipe.length > 100) {
    throw new Error("A ficha técnica possui ingredientes demais.")
  }
  if (rawGroups.length > 25) {
    throw new Error("Este produto possui grupos de complementos demais.")
  }

  const recipe = rawRecipe.map((item) => ({
    ingredientId: Number(item.ingredientId),
    quantity: roundQuantity(Number(item.quantity)),
  }))

  const recipeSeen = new Set<number>()
  for (const item of recipe) {
    if (
      !Number.isInteger(item.ingredientId) ||
      item.ingredientId <= 0 ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new Error("Ficha técnica contém ingrediente ou quantidade inválida.")
    }
    if (recipeSeen.has(item.ingredientId)) {
      throw new Error("Não repita o mesmo ingrediente na ficha técnica.")
    }
    recipeSeen.add(item.ingredientId)
  }

  const groups = rawGroups.map((group, groupIndex) => {
    const name = String(group.name || "").trim()
    const description = String(group.description || "").trim()
    const rawOptions = group.options || []

    if (!name) throw new Error("Todo grupo de complementos precisa de nome.")
    if (name.length > 120 || description.length > 500) {
      throw new Error("Nome ou descrição do grupo de complementos é muito longo.")
    }
    if (rawOptions.length > 100) {
      throw new Error(`${name}: há opções demais neste grupo.`)
    }

    const options = rawOptions.map((option, optionIndex) => {
      const optionName = String(option.name || "").trim()
      const optionDescription = String(option.description || "").trim()
      const rawPriceDelta = Number(option.priceDelta ?? 0)
      const rawSortOrder = Number(option.sortOrder ?? optionIndex)

      if (
        !optionName ||
        optionName.length > 120 ||
        optionDescription.length > 500 ||
        !Number.isFinite(rawPriceDelta) ||
        rawPriceDelta < 0 ||
        !Number.isFinite(rawSortOrder)
      ) {
        throw new Error("Opção de complemento inválida.")
      }

      const priceDelta = Number(rawPriceDelta.toFixed(2))
      const rawIngredients = option.ingredients || []
      if (rawIngredients.length > 50) {
        throw new Error(`${optionName}: há ingredientes demais nesta opção.`)
      }

      const ingredients = rawIngredients.map((ingredient) => ({
        ingredientId: Number(ingredient.ingredientId),
        quantity: roundQuantity(Number(ingredient.quantity)),
      }))
      const seen = new Set<number>()
      for (const ingredient of ingredients) {
        if (
          !Number.isInteger(ingredient.ingredientId) ||
          ingredient.ingredientId <= 0 ||
          !Number.isFinite(ingredient.quantity) ||
          ingredient.quantity <= 0
        ) {
          throw new Error(`Ingrediente inválido na opção ${optionName}.`)
        }
        if (seen.has(ingredient.ingredientId)) {
          throw new Error(`Não repita ingrediente na opção ${optionName}.`)
        }
        seen.add(ingredient.ingredientId)
      }

      return {
        name: optionName,
        description: optionDescription,
        priceDelta,
        includedEligible: Boolean(option.includedEligible),
        active: option.active !== false,
        sortOrder: Math.max(0, Math.floor(rawSortOrder)),
        ingredients,
      }
    })

    const rawMinSelect = Number(group.minSelect ?? 0)
    const rawMaxSelect = Number(group.maxSelect ?? 1)
    const rawIncludedQuantity = Number(group.includedQuantity ?? 0)
    const rawSortOrder = Number(group.sortOrder ?? groupIndex)

    if (
      !Number.isFinite(rawMinSelect) ||
      !Number.isFinite(rawMaxSelect) ||
      !Number.isFinite(rawIncludedQuantity) ||
      !Number.isFinite(rawSortOrder)
    ) {
      throw new Error(`${name}: limites de seleção inválidos.`)
    }

    const minSelect = Math.max(0, Math.floor(rawMinSelect))
    const required = Boolean(group.required)
    const minimum = Math.max(required ? 1 : 0, minSelect)
    const maxSelect = Math.max(1, Math.floor(rawMaxSelect))
    const includedQuantity = Math.max(0, Math.floor(rawIncludedQuantity))
    const active = group.active !== false
    const activeOptions = options.filter((option) => option.active).length

    if (minimum > maxSelect) {
      throw new Error(`${name}: o mínimo de escolhas não pode superar o máximo.`)
    }
    if (active && minimum > activeOptions) {
      throw new Error(`${name}: o mínimo de escolhas é maior que as opções ativas.`)
    }
    if (includedQuantity > maxSelect) {
      throw new Error(`${name}: a quantidade incluída não pode ser maior que o máximo.`)
    }

    const names = new Set<string>()
    for (const option of options) {
      const optionKey = option.name.toLowerCase()
      if (names.has(optionKey)) throw new Error(`${name}: há opções repetidas.`)
      names.add(optionKey)
    }

    return {
      name,
      description,
      required,
      minSelect,
      maxSelect,
      includedQuantity,
      active,
      sortOrder: Math.max(0, Math.floor(rawSortOrder)),
      options,
    }
  })

  return { groups, recipe }
}

export async function replaceProductComposition(
  organizationId: string,
  productId: number,
  input: ProductCompositionInput,
) {
  const normalized = normalizeComposition(input)
  const ingredientIds = [...new Set([
    ...normalized.recipe.map((item) => item.ingredientId),
    ...normalized.groups.flatMap((group) =>
      group.options.flatMap((option) => option.ingredients.map((item) => item.ingredientId)),
    ),
  ])]

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await lockFoodCatalog(client, organizationId)

    const product = await client.query<{ id: number }>(
      `SELECT id FROM sf_products WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
      [organizationId, productId],
    )
    if (!product.rows[0]) throw new Error("Produto não encontrado.")

    if (ingredientIds.length) {
      const ingredients = await client.query<{ id: number }>(
        `SELECT id FROM sf_ingredients WHERE organization_id = $1 AND id = ANY($2::int[])`,
        [organizationId, ingredientIds],
      )
      if (ingredients.rows.length !== ingredientIds.length) {
        throw new Error("A composição usa ingrediente que não pertence a esta empresa.")
      }
    }

    const oldGroups = await client.query<{ group_id: number }>(
      `SELECT group_id FROM sf_product_modifier_groups WHERE organization_id = $1 AND product_id = $2`,
      [organizationId, productId],
    )
    const oldGroupIds = oldGroups.rows.map((row) => Number(row.group_id))

    await client.query(
      `DELETE FROM sf_product_modifier_groups WHERE organization_id = $1 AND product_id = $2`,
      [organizationId, productId],
    )
    if (oldGroupIds.length) {
      await client.query(
        `
          DELETE FROM sf_modifier_groups g
          WHERE g.organization_id = $1
            AND g.id = ANY($2::int[])
            AND NOT EXISTS (
              SELECT 1 FROM sf_product_modifier_groups pmg
              WHERE pmg.organization_id = g.organization_id AND pmg.group_id = g.id
            )
        `,
        [organizationId, oldGroupIds],
      )
    }

    await client.query(
      `DELETE FROM sf_product_ingredients WHERE organization_id = $1 AND product_id = $2`,
      [organizationId, productId],
    )

    for (const recipe of normalized.recipe) {
      await client.query(
        `
          INSERT INTO sf_product_ingredients (organization_id, product_id, ingredient_id, quantity)
          VALUES ($1, $2, $3, $4)
        `,
        [organizationId, productId, recipe.ingredientId, recipe.quantity],
      )
    }

    for (const group of normalized.groups) {
      const groupId = await nextScopedId(client, "sf_modifier_groups", organizationId)
      await client.query(
        `
          INSERT INTO sf_modifier_groups (
            organization_id, id, name, description, required, min_select, max_select,
            included_quantity, active, sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          organizationId,
          groupId,
          group.name,
          group.description,
          group.required,
          group.minSelect,
          group.maxSelect,
          group.includedQuantity,
          group.active,
          group.sortOrder,
        ],
      )
      await client.query(
        `
          INSERT INTO sf_product_modifier_groups (organization_id, product_id, group_id, sort_order)
          VALUES ($1, $2, $3, $4)
        `,
        [organizationId, productId, groupId, group.sortOrder],
      )

      for (const option of group.options) {
        const optionId = await nextScopedId(client, "sf_modifier_options", organizationId)
        await client.query(
          `
            INSERT INTO sf_modifier_options (
              organization_id, id, group_id, name, description, price_delta,
              included_eligible, active, sort_order
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            organizationId,
            optionId,
            groupId,
            option.name,
            option.description,
            option.priceDelta,
            option.includedEligible,
            option.active,
            option.sortOrder,
          ],
        )
        for (const ingredient of option.ingredients) {
          await client.query(
            `
              INSERT INTO sf_modifier_option_ingredients (organization_id, option_id, ingredient_id, quantity)
              VALUES ($1, $2, $3, $4)
            `,
            [organizationId, optionId, ingredient.ingredientId, ingredient.quantity],
          )
        }
      }
    }

    await refreshFoodStateWithClient(client, organizationId, "composition-save")
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  return getProductComposition(organizationId, productId)
}

export async function consumeIngredientsForOrderWithClient(
  client: PoolClient,
  organizationId: string,
  orderId: number,
  lines: CheckoutIngredientLine[],
) {
  if (!lines.length) return [] as number[]
  const productIds = [...new Set(lines.map((line) => line.productId))]
  const optionIds = [...new Set(lines.flatMap((line) => line.optionIds))]

  const productRecipe = await client.query<{
    product_id: number
    ingredient_id: number
    quantity: string | number
  }>(
    `
      SELECT product_id, ingredient_id, quantity
      FROM sf_product_ingredients
      WHERE organization_id = $1 AND product_id = ANY($2::int[])
    `,
    [organizationId, productIds],
  )

  const optionRecipe = optionIds.length
    ? await client.query<{
        option_id: number
        ingredient_id: number
        quantity: string | number
      }>(
        `
          SELECT option_id, ingredient_id, quantity
          FROM sf_modifier_option_ingredients
          WHERE organization_id = $1 AND option_id = ANY($2::int[])
        `,
        [organizationId, optionIds],
      )
    : { rows: [] as Array<{ option_id: number; ingredient_id: number; quantity: string | number }> }

  const productRecipeMap = new Map<number, Array<{ ingredientId: number; quantity: number }>>()
  for (const row of productRecipe.rows) {
    const list = productRecipeMap.get(Number(row.product_id)) || []
    list.push({ ingredientId: Number(row.ingredient_id), quantity: Number(row.quantity) })
    productRecipeMap.set(Number(row.product_id), list)
  }

  const optionRecipeMap = new Map<number, Array<{ ingredientId: number; quantity: number }>>()
  for (const row of optionRecipe.rows) {
    const list = optionRecipeMap.get(Number(row.option_id)) || []
    list.push({ ingredientId: Number(row.ingredient_id), quantity: Number(row.quantity) })
    optionRecipeMap.set(Number(row.option_id), list)
  }

  const required = new Map<number, number>()
  for (const line of lines) {
    for (const recipe of productRecipeMap.get(line.productId) || []) {
      required.set(
        recipe.ingredientId,
        (required.get(recipe.ingredientId) || 0) + recipe.quantity * line.quantity,
      )
    }
    for (const optionId of line.optionIds) {
      for (const recipe of optionRecipeMap.get(optionId) || []) {
        required.set(
          recipe.ingredientId,
          (required.get(recipe.ingredientId) || 0) + recipe.quantity * line.quantity,
        )
      }
    }
  }

  const ingredientIds = [...required.keys()]
  if (!ingredientIds.length) return []

  const ingredients = await client.query<IngredientRow>(
    `
      SELECT id, name, unit, stock_quantity, min_stock_quantity, unit_cost, active, created_at, updated_at
      FROM sf_ingredients
      WHERE organization_id = $1 AND id = ANY($2::int[])
      FOR UPDATE
    `,
    [organizationId, ingredientIds],
  )
  const map = new Map(ingredients.rows.map((row) => [Number(row.id), row]))

  for (const [ingredientId, rawQuantity] of required) {
    const ingredient = map.get(ingredientId)
    const quantity = roundQuantity(rawQuantity)
    if (!ingredient || !ingredient.active) {
      throw new Error("Um ingrediente da ficha técnica está inativo ou indisponível.")
    }
    if (Number(ingredient.stock_quantity) < quantity) {
      throw new Error(
        `${ingredient.name} não possui estoque suficiente para produzir este pedido.`,
      )
    }
  }

  for (const [ingredientId, rawQuantity] of required) {
    const ingredient = map.get(ingredientId)!
    const quantity = roundQuantity(rawQuantity)
    const inserted = await client.query<{ id: number }>(
      `
        INSERT INTO sf_inventory_movements (
          organization_id, ingredient_id, kind, quantity_delta,
          unit_cost_snapshot, order_id, source_key, note
        )
        VALUES ($1, $2, 'sale', $3, $4, $5, $6, $7)
        ON CONFLICT (organization_id, source_key) WHERE source_key IS NOT NULL
        DO NOTHING
        RETURNING id
      `,
      [
        organizationId,
        ingredientId,
        -quantity,
        Number(ingredient.unit_cost),
        orderId,
        `order:${orderId}:ingredient:${ingredientId}:sale`,
        "Baixa automática por pedido",
      ],
    )
    if (inserted.rows[0]) {
      await client.query(
        `
          UPDATE sf_ingredients
          SET stock_quantity = stock_quantity - $3, updated_at = now()
          WHERE organization_id = $1 AND id = $2
        `,
        [organizationId, ingredientId, quantity],
      )
    }
  }

  return ingredientIds
}

export async function reverseIngredientsForOrderWithClient(
  client: PoolClient,
  organizationId: string,
  orderId: number,
) {
  try {
    const sales = await client.query<{
      ingredient_id: number
      quantity_delta: string | number
      unit_cost_snapshot: string | number
    }>(
      `
        SELECT ingredient_id, quantity_delta, unit_cost_snapshot
        FROM sf_inventory_movements
        WHERE organization_id = $1
          AND order_id = $2
          AND kind = 'sale'
        ORDER BY ingredient_id ASC
      `,
      [organizationId, orderId],
    )

    for (const sale of sales.rows) {
      const ingredientId = Number(sale.ingredient_id)
      const restore = roundQuantity(Math.abs(Number(sale.quantity_delta)))
      const sourceKey = `order:${orderId}:ingredient:${ingredientId}:reversal`
      const inserted = await client.query<{ id: number }>(
        `
          INSERT INTO sf_inventory_movements (
            organization_id, ingredient_id, kind, quantity_delta,
            unit_cost_snapshot, order_id, source_key, note
          )
          VALUES ($1, $2, 'reversal', $3, $4, $5, $6, 'Estorno automático por cancelamento')
          ON CONFLICT (organization_id, source_key) WHERE source_key IS NOT NULL
          DO NOTHING
          RETURNING id
        `,
        [organizationId, ingredientId, restore, Number(sale.unit_cost_snapshot), orderId, sourceKey],
      )
      if (inserted.rows[0]) {
        await client.query(
          `
            UPDATE sf_ingredients
            SET stock_quantity = stock_quantity + $3, updated_at = now()
            WHERE organization_id = $1 AND id = $2
          `,
          [organizationId, ingredientId, restore],
        )
      }
    }
  } catch (error) {
    if (missingFoodTables(error)) return
    throw error
  }
}

export async function getTenantInventoryMovements(
  organizationId: string,
  limit = 50,
): Promise<InventoryMovement[]> {
  try {
    const safeLimit = Math.min(200, Math.max(1, Math.floor(Number(limit) || 50)))
    const result = await getPostgresPool().query<{
      id: string | number
      ingredient_id: number
      ingredient_name: string
      kind: InventoryMovement["kind"]
      quantity_delta: string | number
      unit_cost_snapshot: string | number
      order_id: number | null
      note: string
      created_at: Date | string
    }>(
      `
        SELECT
          m.id,
          m.ingredient_id,
          i.name AS ingredient_name,
          m.kind,
          m.quantity_delta,
          m.unit_cost_snapshot,
          m.order_id,
          m.note,
          m.created_at
        FROM sf_inventory_movements m
        INNER JOIN sf_ingredients i
          ON i.organization_id = m.organization_id
         AND i.id = m.ingredient_id
        WHERE m.organization_id = $1
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $2
      `,
      [organizationId, safeLimit],
    )
    return result.rows.map((row) => ({
      id: Number(row.id),
      ingredientId: Number(row.ingredient_id),
      ingredientName: row.ingredient_name,
      kind: row.kind,
      quantityDelta: Number(row.quantity_delta),
      unitCostSnapshot: Number(row.unit_cost_snapshot),
      ...(row.order_id !== null ? { orderId: Number(row.order_id) } : {}),
      note: row.note || "",
      createdAt: iso(row.created_at),
    }))
  } catch (error) {
    if (missingFoodTables(error)) return []
    throw error
  }
}

export async function getFoodCompositionStats(organizationId: string) {
  try {
    const [state, lowStock, movements] = await Promise.all([
      getPostgresPool().query<{
        ready: boolean
        modifier_groups_count: number
        modifier_options_count: number
        ingredients_count: number
        recipe_items_count: number
        updated_at: Date | string
      }>(
        `
          SELECT ready, modifier_groups_count, modifier_options_count, ingredients_count,
                 recipe_items_count, updated_at
          FROM sf_food_composition_state
          WHERE organization_id = $1
          LIMIT 1
        `,
        [organizationId],
      ),
      getPostgresPool().query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM sf_ingredients
          WHERE organization_id = $1
            AND active = true
            AND stock_quantity <= min_stock_quantity
        `,
        [organizationId],
      ),
      getPostgresPool().query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM sf_inventory_movements WHERE organization_id = $1`,
        [organizationId],
      ),
    ])
    const row = state.rows[0]
    return {
      ready: Boolean(row?.ready),
      modifierGroups: Number(row?.modifier_groups_count || 0),
      modifierOptions: Number(row?.modifier_options_count || 0),
      ingredients: Number(row?.ingredients_count || 0),
      recipeItems: Number(row?.recipe_items_count || 0),
      lowStockIngredients: Number(lowStock.rows[0]?.count || 0),
      movements: Number(movements.rows[0]?.count || 0),
      updatedAt: row?.updated_at ? iso(row.updated_at) : null,
    }
  } catch (error) {
    if (missingFoodTables(error)) {
      return {
        ready: false,
        modifierGroups: 0,
        modifierOptions: 0,
        ingredients: 0,
        recipeItems: 0,
        lowStockIngredients: 0,
        movements: 0,
        updatedAt: null,
      }
    }
    throw error
  }
}
