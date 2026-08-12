import { getPostgresPool } from "@/lib/postgres"
import type {
  DreComparisonSummary,
  DreDailyPoint,
  DreExpenseGroup,
  DreExpenseGroupKey,
  DreHealth,
  DreReport,
} from "@/lib/dre-types"

type OrderStatsRow = {
  order_count: string | number
  product_sales: string | number
  delivery_revenue: string | number
  discounts: string | number
  net_sales: string | number
  paid_sales: string | number
  unpaid_sales: string | number
  cancelled_orders: string | number
  cancelled_amount: string | number
  average_ticket: string | number
}

type FinancialRow = {
  type: "income" | "expense"
  category: string
  description: string
  amount: string | number
  created_at: Date | string
}

type CmvRow = {
  cmv: string | number
  orders_with_cmv: string | number
}

type WasteRow = {
  waste: string | number
}

type DailyOrderRow = {
  day: Date | string
  net_sales: string | number
}

type DailyFinancialRow = {
  day: Date | string
  income: string | number
  expense: string | number
}

type DailyCmvRow = {
  day: Date | string
  cmv: string | number
}

type DailyWasteRow = {
  day: Date | string
  waste: string | number
}

const expenseLabels: Record<DreExpenseGroupKey, string> = {
  personnel: "Pessoal e encargos",
  occupancy: "Aluguel e ocupação",
  utilities: "Água, energia e utilidades",
  marketing: "Marketing e publicidade",
  logistics: "Logística e entregas",
  financial: "Despesas financeiras",
  taxes: "Impostos e taxas",
  administrative: "Administrativas",
  maintenance: "Manutenção e reparos",
  inventoryLosses: "Perdas de estoque",
  other: "Outras despesas",
}

const expenseOrder: DreExpenseGroupKey[] = [
  "personnel",
  "occupancy",
  "utilities",
  "marketing",
  "logistics",
  "financial",
  "taxes",
  "administrative",
  "maintenance",
  "inventoryLosses",
  "other",
]

function roundMoney(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2))
}

function percent(value: number, base: number) {
  if (!base) return 0
  return Number(((value / base) * 100).toFixed(2))
}

function deltaPercent(current: number, previous: number): number | null {
  if (!previous) return current === 0 ? 0 : null
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(2))
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function classifyExpense(category: string, description: string): DreExpenseGroupKey {
  const text = normalizeText(`${category} ${description}`)

  if (/salari|folha|funcionar|pessoal|encargo|pro.?labore|beneficio/.test(text)) return "personnel"
  if (/aluguel|condomini|ocupac|imovel/.test(text)) return "occupancy"
  if (/energia|eletric|agua|internet|telefone|gas\b|utilidad/.test(text)) return "utilities"
  if (/marketing|anuncio|publicidade|trafego|social media/.test(text)) return "marketing"
  if (/logistic|entrega|motoboy|frete|combustivel|gasolina|diesel/.test(text)) return "logistics"
  if (/financeir|cartao|maquininha|banco|juros|tarifa banc/.test(text)) return "financial"
  if (/imposto|tribut|simples|das\b|mei\b|taxa fiscal|fiscal/.test(text)) return "taxes"
  if (/administr|contabil|contador|software|sistema|escritorio|material de escritorio/.test(text)) return "administrative"
  if (/manutenc|reparo|conserto|equipamento/.test(text)) return "maintenance"
  if (/perda|desperdicio|quebra|avaria|estoque/.test(text)) return "inventoryLosses"
  return "other"
}

function dateOnly(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const raw = String(value)
  return raw.length >= 10 ? raw.slice(0, 10) : raw
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

function inclusiveDays(start: string, end: string) {
  const first = new Date(`${start}T12:00:00.000Z`).getTime()
  const last = new Date(`${end}T12:00:00.000Z`).getTime()
  return Math.floor((last - first) / 86_400_000) + 1
}

function previousPeriod(start: string, end: string) {
  const days = inclusiveDays(start, end)
  const previousEnd = addDays(start, -1)
  const previousStart = addDays(previousEnd, -(days - 1))
  return { start: previousStart, end: previousEnd }
}

async function getOrganizationTimeZone(organizationId: string) {
  const result = await getPostgresPool().query<{ timezone: string }>(
    `
      SELECT COALESCE(timezone, 'America/Sao_Paulo') AS timezone
      FROM sf_organization_settings
      WHERE organization_id = $1
      LIMIT 1
    `,
    [organizationId],
  )
  return result.rows[0]?.timezone || "America/Sao_Paulo"
}

function periodSql(column: string) {
  return `${column} >= ($2::date::timestamp AT TIME ZONE $4)
      AND ${column} < (($3::date + 1)::timestamp AT TIME ZONE $4)`
}

async function getCoreReport(
  organizationId: string,
  start: string,
  end: string,
  timeZone: string,
  includeDaily: boolean,
) {
  const params = [organizationId, start, end, timeZone]

  const orderStatsPromise = getPostgresPool().query<OrderStatsRow>(
    `
      SELECT
        COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS order_count,
        COALESCE(SUM(subtotal) FILTER (WHERE status <> 'cancelled'), 0) AS product_sales,
        COALESCE(SUM(delivery_fee) FILTER (WHERE status <> 'cancelled'), 0) AS delivery_revenue,
        COALESCE(SUM(discount) FILTER (WHERE status <> 'cancelled'), 0) AS discounts,
        COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0) AS net_sales,
        COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled' AND payment_status = 'paid'), 0) AS paid_sales,
        COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled' AND payment_status = 'unpaid'), 0) AS unpaid_sales,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_orders,
        COALESCE(SUM(total) FILTER (WHERE status = 'cancelled'), 0) AS cancelled_amount,
        COALESCE(AVG(total) FILTER (WHERE status <> 'cancelled'), 0) AS average_ticket
      FROM sf_orders
      WHERE organization_id = $1
        AND ${periodSql("created_at")}
    `,
    params,
  )

  const financialPromise = getPostgresPool().query<FinancialRow>(
    `
      SELECT type, category, description, amount, created_at
      FROM sf_financial_entries
      WHERE organization_id = $1
        AND ${periodSql("created_at")}
      ORDER BY created_at ASC, id ASC
    `,
    params,
  )

  const cmvPromise = getPostgresPool().query<CmvRow>(
    `
      SELECT
        COALESCE(SUM(ABS(m.quantity_delta) * m.unit_cost_snapshot), 0) AS cmv,
        COUNT(DISTINCT m.order_id)::int AS orders_with_cmv
      FROM sf_inventory_movements m
      INNER JOIN sf_orders o
        ON o.organization_id = m.organization_id
       AND o.id = m.order_id
      WHERE m.organization_id = $1
        AND m.kind = 'sale'
        AND o.status <> 'cancelled'
        AND ${periodSql("o.created_at")}
    `,
    params,
  ).catch((error: unknown) => {
    if ((error as { code?: string })?.code === "42P01") {
      return { rows: [{ cmv: 0, orders_with_cmv: 0 }] } as { rows: CmvRow[] }
    }
    throw error
  })

  const wastePromise = getPostgresPool().query<WasteRow>(
    `
      SELECT COALESCE(SUM(ABS(quantity_delta) * unit_cost_snapshot), 0) AS waste
      FROM sf_inventory_movements
      WHERE organization_id = $1
        AND kind = 'waste'
        AND ${periodSql("created_at")}
    `,
    params,
  ).catch((error: unknown) => {
    if ((error as { code?: string })?.code === "42P01") {
      return { rows: [{ waste: 0 }] } as { rows: WasteRow[] }
    }
    throw error
  })

  const foodReadyPromise = getPostgresPool().query<{ ready: boolean }>(
    `SELECT ready FROM sf_food_composition_state WHERE organization_id = $1 LIMIT 1`,
    [organizationId],
  ).then((result) => Boolean(result.rows[0]?.ready)).catch((error: unknown) => {
    if ((error as { code?: string })?.code === "42P01") return false
    throw error
  })

  const dailyOrdersPromise = includeDaily
    ? getPostgresPool().query<DailyOrderRow>(
        `
          SELECT
            (created_at AT TIME ZONE $4)::date AS day,
            COALESCE(SUM(total), 0) AS net_sales
          FROM sf_orders
          WHERE organization_id = $1
            AND status <> 'cancelled'
            AND ${periodSql("created_at")}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        params,
      )
    : Promise.resolve({ rows: [] as DailyOrderRow[] })

  const dailyFinancialPromise = includeDaily
    ? getPostgresPool().query<DailyFinancialRow>(
        `
          SELECT
            (created_at AT TIME ZONE $4)::date AS day,
            COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
            COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expense
          FROM sf_financial_entries
          WHERE organization_id = $1
            AND ${periodSql("created_at")}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        params,
      )
    : Promise.resolve({ rows: [] as DailyFinancialRow[] })

  const dailyCmvPromise = includeDaily
    ? getPostgresPool().query<DailyCmvRow>(
        `
          SELECT
            (o.created_at AT TIME ZONE $4)::date AS day,
            COALESCE(SUM(ABS(m.quantity_delta) * m.unit_cost_snapshot), 0) AS cmv
          FROM sf_inventory_movements m
          INNER JOIN sf_orders o
            ON o.organization_id = m.organization_id
           AND o.id = m.order_id
          WHERE m.organization_id = $1
            AND m.kind = 'sale'
            AND o.status <> 'cancelled'
            AND ${periodSql("o.created_at")}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        params,
      ).catch((error: unknown) => {
        if ((error as { code?: string })?.code === "42P01") return { rows: [] as DailyCmvRow[] }
        throw error
      })
    : Promise.resolve({ rows: [] as DailyCmvRow[] })

  const dailyWastePromise = includeDaily
    ? getPostgresPool().query<DailyWasteRow>(
        `
          SELECT
            (created_at AT TIME ZONE $4)::date AS day,
            COALESCE(SUM(ABS(quantity_delta) * unit_cost_snapshot), 0) AS waste
          FROM sf_inventory_movements
          WHERE organization_id = $1
            AND kind = 'waste'
            AND ${periodSql("created_at")}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        params,
      ).catch((error: unknown) => {
        if ((error as { code?: string })?.code === "42P01") return { rows: [] as DailyWasteRow[] }
        throw error
      })
    : Promise.resolve({ rows: [] as DailyWasteRow[] })

  const [
    orderStatsResult,
    financialResult,
    cmvResult,
    wasteResult,
    foodCompositionReady,
    dailyOrders,
    dailyFinancial,
    dailyCmv,
    dailyWaste,
  ] = await Promise.all([
    orderStatsPromise,
    financialPromise,
    cmvPromise,
    wastePromise,
    foodReadyPromise,
    dailyOrdersPromise,
    dailyFinancialPromise,
    dailyCmvPromise,
    dailyWastePromise,
  ])

  const orderStats = orderStatsResult.rows[0] || ({} as OrderStatsRow)
  const productSales = roundMoney(Number(orderStats.product_sales || 0))
  const deliveryRevenue = roundMoney(Number(orderStats.delivery_revenue || 0))
  const grossRevenue = roundMoney(productSales + deliveryRevenue)
  const discounts = roundMoney(Number(orderStats.discounts || 0))
  const netSales = roundMoney(Number(orderStats.net_sales || 0))
  const paidSales = roundMoney(Number(orderStats.paid_sales || 0))
  const unpaidSales = roundMoney(Number(orderStats.unpaid_sales || 0))
  const orderCount = Number(orderStats.order_count || 0)
  const cancelledOrders = Number(orderStats.cancelled_orders || 0)
  const cancelledAmount = roundMoney(Number(orderStats.cancelled_amount || 0))
  const averageTicket = roundMoney(Number(orderStats.average_ticket || 0))

  let otherIncome = 0
  const expenseMap = new Map<DreExpenseGroupKey, number>()
  for (const entry of financialResult.rows) {
    const amount = Number(entry.amount || 0)
    if (entry.type === "income") {
      otherIncome += amount
      continue
    }
    const key = classifyExpense(entry.category || "", entry.description || "")
    expenseMap.set(key, (expenseMap.get(key) || 0) + amount)
  }

  const waste = roundMoney(Number(wasteResult.rows[0]?.waste || 0))
  if (waste > 0) {
    expenseMap.set("inventoryLosses", (expenseMap.get("inventoryLosses") || 0) + waste)
  }

  const expenses: DreExpenseGroup[] = expenseOrder
    .map((key) => ({
      key,
      label: expenseLabels[key],
      amount: roundMoney(expenseMap.get(key) || 0),
    }))
    .filter((group) => group.amount > 0)

  otherIncome = roundMoney(otherIncome)
  const manualExpenses = roundMoney(
    financialResult.rows
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
  )
  const operatingExpenses = roundMoney(manualExpenses + waste)
  const cmv = roundMoney(Number(cmvResult.rows[0]?.cmv || 0))
  const netRevenue = roundMoney(netSales + otherIncome)
  const grossProfit = roundMoney(netRevenue - cmv)
  const operatingResult = roundMoney(grossProfit - operatingExpenses)
  const netResult = operatingResult
  const ordersWithCmv = Number(cmvResult.rows[0]?.orders_with_cmv || 0)
  const cmvCoveragePercent = orderCount ? Math.min(100, percent(ordersWithCmv, orderCount)) : 100

  const dailyMap = new Map<string, DreDailyPoint>()
  if (includeDaily) {
    for (let day = start; day <= end; day = addDays(day, 1)) {
      dailyMap.set(day, { date: day, netSales: 0, otherIncome: 0, cmv: 0, expenses: 0, netResult: 0 })
    }
    for (const row of dailyOrders.rows) {
      const key = dateOnly(row.day)
      const point = dailyMap.get(key)
      if (point) point.netSales = roundMoney(Number(row.net_sales || 0))
    }
    for (const row of dailyFinancial.rows) {
      const key = dateOnly(row.day)
      const point = dailyMap.get(key)
      if (point) {
        point.otherIncome = roundMoney(Number(row.income || 0))
        point.expenses = roundMoney(Number(row.expense || 0))
      }
    }
    for (const row of dailyCmv.rows) {
      const key = dateOnly(row.day)
      const point = dailyMap.get(key)
      if (point) point.cmv = roundMoney(Number(row.cmv || 0))
    }
    for (const row of dailyWaste.rows) {
      const key = dateOnly(row.day)
      const point = dailyMap.get(key)
      if (point) point.expenses = roundMoney(point.expenses + Number(row.waste || 0))
    }
    for (const point of dailyMap.values()) {
      point.netResult = roundMoney(point.netSales + point.otherIncome - point.cmv - point.expenses)
    }
  }

  return {
    revenue: {
      productSales,
      deliveryRevenue,
      grossRevenue,
      discounts,
      netSales,
      otherIncome,
      netRevenue,
      paidSales,
      unpaidSales,
      cancelledOrders,
      cancelledAmount,
    },
    costs: { cmv, waste },
    result: {
      grossProfit,
      operatingExpenses,
      operatingResult,
      netResult,
      grossMarginPercent: percent(grossProfit, netRevenue),
      netMarginPercent: percent(netResult, netRevenue),
      cmvPercent: percent(cmv, netRevenue),
      averageTicket,
      orderCount,
    },
    expenses,
    daily: [...dailyMap.values()],
    dataQuality: {
      foodCompositionReady,
      ordersWithCmv,
      cmvCoveragePercent,
      manualEntries: financialResult.rows.length,
      cmvComplete: orderCount === 0 || cmvCoveragePercent >= 99.99,
      note:
        orderCount > 0 && cmvCoveragePercent < 99.99
          ? "Parte dos pedidos do período não possui baixa de ingredientes vinculada. Complete as fichas técnicas para que o CMV represente toda a operação."
          : "O CMV usa as baixas reais de ingredientes registradas por pedido; pedidos cancelados são excluídos.",
    },
  }
}

export async function getTenantDreReport(
  organizationId: string,
  start: string,
  end: string,
): Promise<DreReport> {
  const timeZone = await getOrganizationTimeZone(organizationId)
  const current = await getCoreReport(organizationId, start, end, timeZone, true)
  const previous = previousPeriod(start, end)
  const previousCore = await getCoreReport(
    organizationId,
    previous.start,
    previous.end,
    timeZone,
    false,
  )

  const comparison: DreComparisonSummary = {
    start: previous.start,
    end: previous.end,
    netRevenue: previousCore.revenue.netRevenue,
    cmv: previousCore.costs.cmv,
    grossProfit: previousCore.result.grossProfit,
    operatingExpenses: previousCore.result.operatingExpenses,
    netResult: previousCore.result.netResult,
    grossMarginPercent: previousCore.result.grossMarginPercent,
    netMarginPercent: previousCore.result.netMarginPercent,
    deltas: {
      netRevenuePercent: deltaPercent(current.revenue.netRevenue, previousCore.revenue.netRevenue),
      grossProfitPercent: deltaPercent(current.result.grossProfit, previousCore.result.grossProfit),
      netResultPercent: deltaPercent(current.result.netResult, previousCore.result.netResult),
    },
  }

  return {
    ok: true,
    phase: 13,
    regime: "competencia-gerencial",
    period: { start, end, timeZone },
    ...current,
    comparison,
  }
}

export async function getTenantDreHealth(organizationId: string): Promise<DreHealth> {
  const result = await getPostgresPool().query<{
    orders: boolean
    financial_entries: boolean
    inventory_movements: boolean
    food_state: boolean
  }>(
    `
      SELECT
        to_regclass('public.sf_orders') IS NOT NULL AS orders,
        to_regclass('public.sf_financial_entries') IS NOT NULL AS financial_entries,
        to_regclass('public.sf_inventory_movements') IS NOT NULL AS inventory_movements,
        to_regclass('public.sf_food_composition_state') IS NOT NULL AS food_state
    `,
  )
  const sources = result.rows[0]
  let foodCompositionReady = false

  if (sources?.food_state) {
    const state = await getPostgresPool().query<{ ready: boolean }>(
      `SELECT ready FROM sf_food_composition_state WHERE organization_id = $1 LIMIT 1`,
      [organizationId],
    )
    foodCompositionReady = Boolean(state.rows[0]?.ready)
  }

  const orders = Boolean(sources?.orders)
  const financialEntries = Boolean(sources?.financial_entries)
  const inventoryMovements = Boolean(sources?.inventory_movements)
  const foodCompositionState = Boolean(sources?.food_state)

  return {
    ok: orders && financialEntries,
    phase: 13,
    organizationId,
    sources: {
      orders,
      financialEntries,
      inventoryMovements,
      foodCompositionState,
    },
    cmv: {
      ready: inventoryMovements && foodCompositionState && foodCompositionReady,
      foodCompositionReady,
    },
    regime: "competencia-gerencial",
    note: "A DRE é gerencial por competência: vendas não canceladas entram pela data do pedido; fluxo de caixa permanece separado em Vendas e caixa.",
  }
}
