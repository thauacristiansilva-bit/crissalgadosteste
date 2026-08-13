import { randomUUID } from "node:crypto"
import { getBillingSnapshotForOrganization } from "@/lib/billing-db"
import { getPostgresPool } from "@/lib/postgres"
import type { TenantAdminSession } from "@/lib/tenant-access"

export type FoodOperationsIngredient = {
  id: number
  name: string
  unit: string
  stockQuantity: number
  minStockQuantity: number
  unitCost: number
}

export type FoodOperationsProduct = {
  id: number
  name: string
  recipeItems: number
  theoreticalUnitCost: number
}

export type IngredientLot = {
  id: string
  ingredientId: number
  ingredientName: string
  lotCode: string
  supplier: string
  receivedAt: string
  expiresAt: string | null
  quantityReceived: number
  quantityDiscarded: number
  unitCost: number
  status: "active" | "closed" | "discarded"
  note: string
  createdAt: string
}

export type ProductionRun = {
  id: string
  productId: number
  productName: string
  batchCode: string
  producedAt: string
  plannedYield: number
  actualYield: number
  wasteQuantity: number
  recipeItemsCount: number
  theoreticalUnitCost: number
  theoreticalBatchCost: number
  effectiveUnitCost: number
  yieldEfficiency: number
  note: string
}

export type InventoryCount = {
  id: string
  reference: string
  note: string
  countedAt: string
  totalItems: number
  adjustedItems: number
  valueDifference: number
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString().slice(0, 10)
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function canAccessFoodOperations(session: TenantAdminSession) {
  return ["owner", "admin", "manager"].includes(session.role)
}

async function billingState(session: TenantAdminSession) {
  const billing = await getBillingSnapshotForOrganization(session.organizationId)
  const subscriptionActive =
    billing.account?.status === "active" &&
    ["active", "trialing"].includes(billing.subscription?.status || "")
  return {
    billing,
    subscriptionActive,
    entitlementEnabled: Boolean(billing.entitlements.inventory),
  }
}

async function assertFoodOperationsAvailable(session: TenantAdminSession) {
  if (!canAccessFoodOperations(session)) {
    throw new Error("Seu perfil não possui acesso à operação alimentar avançada.")
  }
  const state = await billingState(session)
  if (!state.subscriptionActive) {
    throw new Error("A assinatura precisa estar ativa para usar a operação alimentar avançada.")
  }
  if (!state.entitlementEnabled) {
    throw new Error("Estoque e operação alimentar não estão incluídos no plano atual.")
  }
  return state
}

async function schemaReady() {
  const result = await getPostgresPool().query<{
    lots: string | null
    runs: string | null
    counts: string | null
    count_items: string | null
  }>(
    `
      SELECT
        to_regclass('public.sf_ingredient_lots')::text AS lots,
        to_regclass('public.sf_food_production_runs')::text AS runs,
        to_regclass('public.sf_inventory_counts')::text AS counts,
        to_regclass('public.sf_inventory_count_items')::text AS count_items
    `,
  )
  const row = result.rows[0]
  return Boolean(row?.lots && row.runs && row.counts && row.count_items)
}

export async function getFoodOperationsOverview(session: TenantAdminSession) {
  const state = await assertFoodOperationsAvailable(session)
  if (!(await schemaReady())) {
    throw new Error("Execute a migration 021_advanced_food_operations antes de usar esta área.")
  }

  const [ingredientsResult, productsResult, lotsResult, runsResult, countsResult] = await Promise.all([
    getPostgresPool().query<{
      id: number
      name: string
      unit: string
      stock_quantity: string | number
      min_stock_quantity: string | number
      unit_cost: string | number
    }>(
      `
        SELECT id, name, unit, stock_quantity, min_stock_quantity, unit_cost
        FROM sf_ingredients
        WHERE organization_id = $1 AND active = true
        ORDER BY name ASC, id ASC
      `,
      [session.organizationId],
    ),
    getPostgresPool().query<{
      id: number
      name: string
      recipe_items: string | number
      theoretical_unit_cost: string | number
    }>(
      `
        SELECT
          p.id,
          p.name,
          COUNT(pi.ingredient_id)::int AS recipe_items,
          COALESCE(SUM(pi.quantity * i.unit_cost), 0) AS theoretical_unit_cost
        FROM sf_products p
        LEFT JOIN sf_product_ingredients pi
          ON pi.organization_id = p.organization_id
         AND pi.product_id = p.id
        LEFT JOIN sf_ingredients i
          ON i.organization_id = pi.organization_id
         AND i.id = pi.ingredient_id
        WHERE p.organization_id = $1
        GROUP BY p.id, p.name
        ORDER BY p.name ASC, p.id ASC
      `,
      [session.organizationId],
    ),
    getPostgresPool().query<{
      id: string
      ingredient_id: number
      ingredient_name: string
      lot_code: string
      supplier: string
      received_at: Date | string
      expires_at: Date | string | null
      quantity_received: string | number
      quantity_discarded: string | number
      unit_cost: string | number
      status: IngredientLot["status"]
      note: string
      created_at: Date | string
    }>(
      `
        SELECT
          l.id, l.ingredient_id, i.name AS ingredient_name, l.lot_code, l.supplier,
          l.received_at, l.expires_at, l.quantity_received, l.quantity_discarded,
          l.unit_cost, l.status, l.note, l.created_at
        FROM sf_ingredient_lots l
        INNER JOIN sf_ingredients i
          ON i.organization_id = l.organization_id
         AND i.id = l.ingredient_id
        WHERE l.organization_id = $1
        ORDER BY
          CASE WHEN l.status = 'active' THEN 0 ELSE 1 END,
          l.expires_at ASC NULLS LAST,
          l.received_at DESC,
          l.created_at DESC
        LIMIT 100
      `,
      [session.organizationId],
    ),
    getPostgresPool().query<{
      id: string
      product_id: number
      product_name: string
      batch_code: string
      produced_at: Date | string
      planned_yield: string | number
      actual_yield: string | number
      waste_quantity: string | number
      recipe_items_count: number
      theoretical_unit_cost: string | number
      theoretical_batch_cost: string | number
      effective_unit_cost: string | number
      yield_efficiency: string | number
      note: string
    }>(
      `
        SELECT
          r.id, r.product_id, p.name AS product_name, r.batch_code, r.produced_at,
          r.planned_yield, r.actual_yield, r.waste_quantity, r.recipe_items_count,
          r.theoretical_unit_cost, r.theoretical_batch_cost, r.effective_unit_cost,
          r.yield_efficiency, r.note
        FROM sf_food_production_runs r
        INNER JOIN sf_products p
          ON p.organization_id = r.organization_id
         AND p.id = r.product_id
        WHERE r.organization_id = $1
        ORDER BY r.produced_at DESC, r.created_at DESC
        LIMIT 100
      `,
      [session.organizationId],
    ),
    getPostgresPool().query<{
      id: string
      reference: string
      note: string
      counted_at: Date | string
      total_items: number
      adjusted_items: number
      value_difference: string | number
    }>(
      `
        SELECT id, reference, note, counted_at, total_items, adjusted_items, value_difference
        FROM sf_inventory_counts
        WHERE organization_id = $1
        ORDER BY counted_at DESC, created_at DESC
        LIMIT 30
      `,
      [session.organizationId],
    ),
  ])

  const ingredients: FoodOperationsIngredient[] = ingredientsResult.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    unit: row.unit,
    stockQuantity: Number(row.stock_quantity),
    minStockQuantity: Number(row.min_stock_quantity),
    unitCost: Number(row.unit_cost),
  }))

  const products: FoodOperationsProduct[] = productsResult.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    recipeItems: Number(row.recipe_items),
    theoreticalUnitCost: Number(row.theoretical_unit_cost),
  }))

  const lots: IngredientLot[] = lotsResult.rows.map((row) => ({
    id: row.id,
    ingredientId: Number(row.ingredient_id),
    ingredientName: row.ingredient_name,
    lotCode: row.lot_code,
    supplier: row.supplier,
    receivedAt: toDate(row.received_at) || "",
    expiresAt: toDate(row.expires_at),
    quantityReceived: Number(row.quantity_received),
    quantityDiscarded: Number(row.quantity_discarded),
    unitCost: Number(row.unit_cost),
    status: row.status,
    note: row.note,
    createdAt: toIso(row.created_at),
  }))

  const productionRuns: ProductionRun[] = runsResult.rows.map((row) => ({
    id: row.id,
    productId: Number(row.product_id),
    productName: row.product_name,
    batchCode: row.batch_code,
    producedAt: toIso(row.produced_at),
    plannedYield: Number(row.planned_yield),
    actualYield: Number(row.actual_yield),
    wasteQuantity: Number(row.waste_quantity),
    recipeItemsCount: Number(row.recipe_items_count),
    theoreticalUnitCost: Number(row.theoretical_unit_cost),
    theoreticalBatchCost: Number(row.theoretical_batch_cost),
    effectiveUnitCost: Number(row.effective_unit_cost),
    yieldEfficiency: Number(row.yield_efficiency),
    note: row.note,
  }))

  const inventoryCounts: InventoryCount[] = countsResult.rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    note: row.note,
    countedAt: toIso(row.counted_at),
    totalItems: Number(row.total_items),
    adjustedItems: Number(row.adjusted_items),
    valueDifference: Number(row.value_difference),
  }))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const sevenDays = new Date(today)
  sevenDays.setDate(sevenDays.getDate() + 7)
  const activeLots = lots.filter((lot) => lot.status === "active")
  const expiredLots = activeLots.filter((lot) => lot.expiresAt && new Date(`${lot.expiresAt}T00:00:00`) < today)
  const expiringLots = activeLots.filter((lot) => {
    if (!lot.expiresAt) return false
    const date = new Date(`${lot.expiresAt}T00:00:00`)
    return date >= today && date <= sevenDays
  })
  const lowStock = ingredients.filter((item) => item.stockQuantity <= item.minStockQuantity)
  const recentRuns = productionRuns.slice(0, 20)
  const averageYieldEfficiency = recentRuns.length
    ? round(recentRuns.reduce((sum, run) => sum + run.yieldEfficiency, 0) / recentRuns.length, 2)
    : 0

  return {
    organization: { id: session.organizationId, name: session.organizationName },
    billing: {
      subscriptionActive: state.subscriptionActive,
      inventoryIncluded: state.entitlementEnabled,
      planCode: state.billing.subscription?.planCode || null,
    },
    ingredients,
    products,
    lots,
    productionRuns,
    inventoryCounts,
    summary: {
      ingredients: ingredients.length,
      lowStock: lowStock.length,
      activeLots: activeLots.length,
      expiringLots: expiringLots.length,
      expiredLots: expiredLots.length,
      productionRuns: productionRuns.length,
      averageYieldEfficiency,
      stockValue: round(ingredients.reduce((sum, item) => sum + item.stockQuantity * item.unitCost, 0), 2),
    },
  }
}

export async function receiveIngredientLot(
  session: TenantAdminSession,
  input: {
    ingredientId: number
    lotCode: string
    supplier?: string
    receivedAt?: string
    expiresAt?: string | null
    quantity: number
    unitCost: number
    note?: string
  },
) {
  await assertFoodOperationsAvailable(session)
  const ingredientId = Number(input.ingredientId)
  const quantity = Number(input.quantity)
  const unitCost = Number(input.unitCost)
  const lotCode = String(input.lotCode || "").trim().slice(0, 80)
  if (!Number.isInteger(ingredientId) || ingredientId <= 0) throw new Error("Ingrediente inválido.")
  if (!lotCode) throw new Error("Informe o código do lote.")
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("A quantidade recebida deve ser maior que zero.")
  if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("Custo unitário inválido.")

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const ingredient = await client.query<{
      stock_quantity: string | number
      unit_cost: string | number
    }>(
      `
        SELECT stock_quantity, unit_cost
        FROM sf_ingredients
        WHERE organization_id = $1 AND id = $2 AND active = true
        FOR UPDATE
      `,
      [session.organizationId, ingredientId],
    )
    if (!ingredient.rows[0]) throw new Error("Ingrediente não encontrado ou inativo.")

    const oldStock = Number(ingredient.rows[0].stock_quantity)
    const oldCost = Number(ingredient.rows[0].unit_cost)
    const nextStock = round(oldStock + quantity, 3)
    const weightedCost = nextStock > 0
      ? round(((oldStock * oldCost) + (quantity * unitCost)) / nextStock, 4)
      : unitCost

    const lot = await client.query<{ id: string }>(
      `
        INSERT INTO sf_ingredient_lots (
          organization_id, ingredient_id, lot_code, supplier, received_at, expires_at,
          quantity_received, unit_cost, note, created_by_user_id
        ) VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6::date, $7, $8, $9, $10)
        RETURNING id
      `,
      [
        session.organizationId,
        ingredientId,
        lotCode,
        String(input.supplier || "").trim().slice(0, 120),
        input.receivedAt || null,
        input.expiresAt || null,
        quantity,
        unitCost,
        String(input.note || "").trim().slice(0, 500),
        session.userId,
      ],
    )
    const lotId = lot.rows[0]?.id
    if (!lotId) throw new Error("Não foi possível criar o lote.")

    await client.query(
      `
        UPDATE sf_ingredients
        SET stock_quantity = $3, unit_cost = $4, updated_at = now()
        WHERE organization_id = $1 AND id = $2
      `,
      [session.organizationId, ingredientId, nextStock, weightedCost],
    )

    await client.query(
      `
        INSERT INTO sf_inventory_movements (
          organization_id, ingredient_id, kind, quantity_delta,
          unit_cost_snapshot, source_key, note
        ) VALUES ($1, $2, 'manual_in', $3, $4, $5, $6)
      `,
      [
        session.organizationId,
        ingredientId,
        quantity,
        unitCost,
        `phase22:lot:${lotId}:receive`,
        `Recebimento do lote ${lotCode}${input.supplier ? ` · ${String(input.supplier).trim()}` : ""}`,
      ],
    )

    await client.query("COMMIT")
    return { lotId, nextStock, weightedCost }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function wasteIngredientLot(
  session: TenantAdminSession,
  input: { lotId: string; quantity: number; reason: string },
) {
  await assertFoodOperationsAvailable(session)
  const lotId = String(input.lotId || "").trim()
  const quantity = Number(input.quantity)
  const reason = String(input.reason || "").trim().slice(0, 500)
  if (!lotId) throw new Error("Lote inválido.")
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("A perda deve ser maior que zero.")
  if (!reason) throw new Error("Informe o motivo da perda.")

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const lot = await client.query<{
      ingredient_id: number
      lot_code: string
      quantity_received: string | number
      quantity_discarded: string | number
      unit_cost: string | number
      status: string
    }>(
      `
        SELECT ingredient_id, lot_code, quantity_received, quantity_discarded, unit_cost, status
        FROM sf_ingredient_lots
        WHERE organization_id = $1 AND id = $2
        FOR UPDATE
      `,
      [session.organizationId, lotId],
    )
    const row = lot.rows[0]
    if (!row) throw new Error("Lote não encontrado.")
    if (row.status !== "active") throw new Error("Somente lotes ativos podem registrar perda.")

    const availableForDiscard = Number(row.quantity_received) - Number(row.quantity_discarded)
    if (quantity > availableForDiscard) throw new Error("A perda excede a quantidade rastreada no lote.")

    const ingredient = await client.query<{ stock_quantity: string | number }>(
      `
        SELECT stock_quantity
        FROM sf_ingredients
        WHERE organization_id = $1 AND id = $2
        FOR UPDATE
      `,
      [session.organizationId, row.ingredient_id],
    )
    if (!ingredient.rows[0]) throw new Error("Ingrediente do lote não encontrado.")
    const currentStock = Number(ingredient.rows[0].stock_quantity)
    if (quantity > currentStock) throw new Error("A perda excede o saldo atual do ingrediente.")

    const nextDiscarded = round(Number(row.quantity_discarded) + quantity, 3)
    const nextStatus = nextDiscarded >= Number(row.quantity_received) ? "discarded" : "active"
    const nextStock = round(currentStock - quantity, 3)

    await client.query(
      `
        UPDATE sf_ingredient_lots
        SET quantity_discarded = $3, status = $4, updated_at = now()
        WHERE organization_id = $1 AND id = $2
      `,
      [session.organizationId, lotId, nextDiscarded, nextStatus],
    )
    await client.query(
      `
        UPDATE sf_ingredients
        SET stock_quantity = $3, updated_at = now()
        WHERE organization_id = $1 AND id = $2
      `,
      [session.organizationId, row.ingredient_id, nextStock],
    )
    await client.query(
      `
        INSERT INTO sf_inventory_movements (
          organization_id, ingredient_id, kind, quantity_delta,
          unit_cost_snapshot, source_key, note
        ) VALUES ($1, $2, 'waste', $3, $4, $5, $6)
      `,
      [
        session.organizationId,
        row.ingredient_id,
        -quantity,
        Number(row.unit_cost),
        `phase22:lot:${lotId}:waste:${randomUUID()}`,
        `Perda no lote ${row.lot_code}: ${reason}`,
      ],
    )

    await client.query("COMMIT")
    return { nextStock, lotStatus: nextStatus }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function closeIngredientLot(
  session: TenantAdminSession,
  input: { lotId: string },
) {
  await assertFoodOperationsAvailable(session)
  const lotId = String(input.lotId || "").trim()
  if (!lotId) throw new Error("Lote inválido.")
  const result = await getPostgresPool().query(
    `
      UPDATE sf_ingredient_lots
      SET status = 'closed', updated_at = now()
      WHERE organization_id = $1 AND id = $2 AND status = 'active'
    `,
    [session.organizationId, lotId],
  )
  if (!result.rowCount) throw new Error("Lote ativo não encontrado.")
}

export async function createProductionRun(
  session: TenantAdminSession,
  input: {
    productId: number
    batchCode: string
    plannedYield: number
    actualYield: number
    wasteQuantity?: number
    producedAt?: string
    note?: string
  },
) {
  await assertFoodOperationsAvailable(session)
  const productId = Number(input.productId)
  const batchCode = String(input.batchCode || "").trim().slice(0, 80)
  const plannedYield = Number(input.plannedYield)
  const actualYield = Number(input.actualYield)
  const wasteQuantity = Number(input.wasteQuantity || 0)
  if (!Number.isInteger(productId) || productId <= 0) throw new Error("Produto inválido.")
  if (!batchCode) throw new Error("Informe o código da produção.")
  if (!Number.isFinite(plannedYield) || plannedYield <= 0) throw new Error("Rendimento planejado inválido.")
  if (!Number.isFinite(actualYield) || actualYield <= 0) throw new Error("Rendimento real inválido.")
  if (!Number.isFinite(wasteQuantity) || wasteQuantity < 0) throw new Error("Perda de produção inválida.")

  const recipe = await getPostgresPool().query<{
    product_name: string
    recipe_items: number
    theoretical_unit_cost: string | number
  }>(
    `
      SELECT
        p.name AS product_name,
        COUNT(pi.ingredient_id)::int AS recipe_items,
        COALESCE(SUM(pi.quantity * i.unit_cost), 0) AS theoretical_unit_cost
      FROM sf_products p
      LEFT JOIN sf_product_ingredients pi
        ON pi.organization_id = p.organization_id
       AND pi.product_id = p.id
      LEFT JOIN sf_ingredients i
        ON i.organization_id = pi.organization_id
       AND i.id = pi.ingredient_id
      WHERE p.organization_id = $1 AND p.id = $2
      GROUP BY p.id, p.name
    `,
    [session.organizationId, productId],
  )
  const product = recipe.rows[0]
  if (!product) throw new Error("Produto não encontrado.")
  if (Number(product.recipe_items) <= 0) throw new Error("Cadastre a ficha técnica do produto antes de apontar produção.")

  const theoreticalUnitCost = round(Number(product.theoretical_unit_cost), 4)
  const theoreticalBatchCost = round(theoreticalUnitCost * plannedYield, 4)
  const effectiveUnitCost = round(theoreticalBatchCost / actualYield, 4)
  const yieldEfficiency = round((actualYield / plannedYield) * 100, 3)

  const result = await getPostgresPool().query<{ id: string }>(
    `
      INSERT INTO sf_food_production_runs (
        organization_id, product_id, batch_code, produced_at,
        planned_yield, actual_yield, waste_quantity, recipe_items_count,
        theoretical_unit_cost, theoretical_batch_cost, effective_unit_cost,
        yield_efficiency, note, created_by_user_id
      ) VALUES (
        $1, $2, $3, COALESCE($4::timestamptz, now()),
        $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING id
    `,
    [
      session.organizationId,
      productId,
      batchCode,
      input.producedAt || null,
      plannedYield,
      actualYield,
      wasteQuantity,
      Number(product.recipe_items),
      theoreticalUnitCost,
      theoreticalBatchCost,
      effectiveUnitCost,
      yieldEfficiency,
      String(input.note || "").trim().slice(0, 500),
      session.userId,
    ],
  )
  return {
    id: result.rows[0]?.id,
    productName: product.product_name,
    theoreticalUnitCost,
    theoreticalBatchCost,
    effectiveUnitCost,
    yieldEfficiency,
  }
}

export async function createInventoryCount(
  session: TenantAdminSession,
  input: {
    reference: string
    note?: string
    items: Array<{ ingredientId: number; countedQuantity: number }>
  },
) {
  await assertFoodOperationsAvailable(session)
  const reference = String(input.reference || "").trim().slice(0, 100)
  if (!reference) throw new Error("Informe uma referência para a contagem.")
  if (!Array.isArray(input.items) || !input.items.length) throw new Error("Informe pelo menos um item contado.")
  if (input.items.length > 200) throw new Error("A contagem aceita no máximo 200 ingredientes por vez.")

  const normalized = new Map<number, number>()
  for (const item of input.items) {
    const ingredientId = Number(item.ingredientId)
    const countedQuantity = Number(item.countedQuantity)
    if (!Number.isInteger(ingredientId) || ingredientId <= 0) throw new Error("Ingrediente inválido na contagem.")
    if (!Number.isFinite(countedQuantity) || countedQuantity < 0) throw new Error("Quantidade contada inválida.")
    normalized.set(ingredientId, countedQuantity)
  }

  const countId = randomUUID()
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `
        INSERT INTO sf_inventory_counts (
          id, organization_id, reference, note, counted_by_user_id
        ) VALUES ($1, $2, $3, $4, $5)
      `,
      [countId, session.organizationId, reference, String(input.note || "").trim().slice(0, 500), session.userId],
    )

    let adjustedItems = 0
    let valueDifference = 0
    for (const [ingredientId, countedQuantity] of normalized.entries()) {
      const result = await client.query<{
        stock_quantity: string | number
        unit_cost: string | number
      }>(
        `
          SELECT stock_quantity, unit_cost
          FROM sf_ingredients
          WHERE organization_id = $1 AND id = $2 AND active = true
          FOR UPDATE
        `,
        [session.organizationId, ingredientId],
      )
      const row = result.rows[0]
      if (!row) throw new Error(`Ingrediente ${ingredientId} não encontrado ou inativo.`)
      const systemQuantity = Number(row.stock_quantity)
      const unitCost = Number(row.unit_cost)
      const difference = round(countedQuantity - systemQuantity, 3)
      valueDifference += difference * unitCost

      await client.query(
        `
          INSERT INTO sf_inventory_count_items (
            count_id, organization_id, ingredient_id, system_quantity,
            counted_quantity, quantity_difference, unit_cost_snapshot
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [countId, session.organizationId, ingredientId, systemQuantity, countedQuantity, difference, unitCost],
      )

      if (difference !== 0) {
        adjustedItems += 1
        await client.query(
          `
            UPDATE sf_ingredients
            SET stock_quantity = $3, updated_at = now()
            WHERE organization_id = $1 AND id = $2
          `,
          [session.organizationId, ingredientId, countedQuantity],
        )
        await client.query(
          `
            INSERT INTO sf_inventory_movements (
              organization_id, ingredient_id, kind, quantity_delta,
              unit_cost_snapshot, source_key, note
            ) VALUES ($1, $2, 'adjustment', $3, $4, $5, $6)
          `,
          [
            session.organizationId,
            ingredientId,
            difference,
            unitCost,
            `phase22:count:${countId}:ingredient:${ingredientId}`,
            `Inventário físico ${reference}`,
          ],
        )
      }
    }

    await client.query(
      `
        UPDATE sf_inventory_counts
        SET total_items = $2, adjusted_items = $3, value_difference = $4
        WHERE id = $1
      `,
      [countId, normalized.size, adjustedItems, round(valueDifference, 4)],
    )
    await client.query("COMMIT")
    return { countId, totalItems: normalized.size, adjustedItems, valueDifference: round(valueDifference, 4) }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function foodOperationsHealth(session: TenantAdminSession) {
  const state = await billingState(session)
  const ready = await schemaReady()
  if (!ready) {
    return {
      schemaReady: false,
      organizationLinked: true,
      subscriptionActive: state.subscriptionActive,
      entitlementEnabled: state.entitlementEnabled,
      counts: { lots: 0, productionRuns: 0, inventoryCounts: 0, expiredActiveLots: 0 },
    }
  }

  const result = await getPostgresPool().query<{
    lots: number
    production_runs: number
    inventory_counts: number
    expired_active_lots: number
  }>(
    `
      SELECT
        (SELECT COUNT(*)::int FROM sf_ingredient_lots WHERE organization_id = $1) AS lots,
        (SELECT COUNT(*)::int FROM sf_food_production_runs WHERE organization_id = $1) AS production_runs,
        (SELECT COUNT(*)::int FROM sf_inventory_counts WHERE organization_id = $1) AS inventory_counts,
        (
          SELECT COUNT(*)::int
          FROM sf_ingredient_lots
          WHERE organization_id = $1
            AND status = 'active'
            AND expires_at IS NOT NULL
            AND expires_at < CURRENT_DATE
        ) AS expired_active_lots
    `,
    [session.organizationId],
  )
  const row = result.rows[0]
  return {
    schemaReady: true,
    organizationLinked: true,
    subscriptionActive: state.subscriptionActive,
    entitlementEnabled: state.entitlementEnabled,
    counts: {
      lots: Number(row?.lots || 0),
      productionRuns: Number(row?.production_runs || 0),
      inventoryCounts: Number(row?.inventory_counts || 0),
      expiredActiveLots: Number(row?.expired_active_lots || 0),
    },
  }
}
