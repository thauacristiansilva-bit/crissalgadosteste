import { getBillingSnapshotForOrganization } from "@/lib/billing-db"
import { getCorporateOverview } from "@/lib/corporate-db"
import { getPostgresPool } from "@/lib/postgres"
import { enterTenantRlsScope } from "@/lib/rls-context"
import type { TenantAdminSession } from "@/lib/tenant-access"
import type {
  ManagementReport,
  ManagementReportScope,
  ReportBreakdown,
  ReportCustomer,
  ReportDailyPoint,
  ReportProduct,
  ReportUnit,
  ReportsHealth,
} from "@/lib/reports-types"

const MAX_RANGE_DAYS = 366

export function canAccessManagementReports(session: TenantAdminSession) {
  return ["owner", "admin", "manager"].includes(session.role)
}

type SummaryRow = {
  orders: string | number
  completed_orders: string | number
  cancelled_orders: string | number
  revenue: string | number
  paid_revenue: string | number
  unpaid_revenue: string | number
  average_ticket: string | number
  discounts: string | number
  delivery_revenue: string | number
}

type FinanceRow = {
  income: string | number
  expenses: string | number
}

type ProductRow = {
  name: string
  quantity: string | number
  revenue: string | number
  orders: string | number
}

type BreakdownRow = {
  key: string
  orders: string | number
  revenue: string | number
}

type DailyRow = {
  day: Date | string
  orders: string | number
  revenue: string | number
  average_ticket: string | number
}

type UnitRow = {
  organization_id: string
  name: string
  orders: string | number
  revenue: string | number
  average_ticket: string | number
}

type CustomerSummaryRow = {
  identified_customers: string | number
  returning_customers: string | number
}

type CustomerRow = {
  name: string
  orders: string | number
  revenue: string | number
  average_ticket: string | number
}

function number(value: string | number | null | undefined) {
  return Number(value || 0)
}

function round(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2))
}

function percent(value: number, base: number) {
  return base > 0 ? round((value / base) * 100) : 0
}

function deltaPercent(current: number, previous: number): number | null {
  if (!previous) return current === 0 ? 0 : null
  return round(((current - previous) / Math.abs(previous)) * 100)
}

function dateOnly(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
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

export function normalizeReportPeriod(startRaw?: string | null, endRaw?: string | null) {
  const today = new Date().toISOString().slice(0, 10)
  const fallbackStart = addDays(today, -29)
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startRaw || "") ? String(startRaw) : fallbackStart
  const end = /^\d{4}-\d{2}-\d{2}$/.test(endRaw || "") ? String(endRaw) : today
  if (start > end) throw new Error("A data inicial não pode ser posterior à data final.")
  const days = inclusiveDays(start, end)
  if (days < 1 || days > MAX_RANGE_DAYS) {
    throw new Error(`O período dos relatórios deve ter entre 1 e ${MAX_RANGE_DAYS} dias.`)
  }
  const previousEnd = addDays(start, -1)
  const previousStart = addDays(previousEnd, -(days - 1))
  return { start, end, previousStart, previousEnd, days }
}

async function organizationTimeZone(organizationId: string) {
  const result = await getPostgresPool().query<{ timezone: string }>(
    `SELECT COALESCE(timezone, 'America/Sao_Paulo') AS timezone FROM sf_organization_settings WHERE organization_id = $1 LIMIT 1`,
    [organizationId],
  )
  return result.rows[0]?.timezone || "America/Sao_Paulo"
}

async function reportScope(session: TenantAdminSession, requested: ManagementReportScope) {
  const corporate = await getCorporateOverview(session)
  const groupAvailable = Boolean(corporate.group && corporate.group.role && corporate.organizations.some((item) => item.inGroup))

  if (requested === "group") {
    if (!groupAvailable) throw new Error("Nenhum grupo empresarial está disponível para este usuário.")
    const units = corporate.organizations.filter((item) => item.inGroup)
    return {
      requested,
      groupAvailable,
      organizationIds: units.map((item) => item.id),
      organizationNames: units.map((item) => item.name),
    }
  }

  return {
    requested: "organization" as const,
    groupAvailable,
    organizationIds: [session.organizationId],
    organizationNames: [session.organizationName],
  }
}

function periodSql(column: string) {
  return `${column} >= ($2::date::timestamp AT TIME ZONE $4)
      AND ${column} < (($3::date + 1)::timestamp AT TIME ZONE $4)`
}

async function summary(organizationIds: string[], start: string, end: string, timeZone: string) {
  const result = await getPostgresPool().query<SummaryRow>(
    `
      SELECT
        COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS orders,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_orders,
        COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0) AS revenue,
        COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled' AND payment_status = 'paid'), 0) AS paid_revenue,
        COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled' AND payment_status = 'unpaid'), 0) AS unpaid_revenue,
        COALESCE(AVG(total) FILTER (WHERE status <> 'cancelled'), 0) AS average_ticket,
        COALESCE(SUM(discount) FILTER (WHERE status <> 'cancelled'), 0) AS discounts,
        COALESCE(SUM(delivery_fee) FILTER (WHERE status <> 'cancelled'), 0) AS delivery_revenue
      FROM sf_orders
      WHERE organization_id = ANY($1::uuid[])
        AND ${periodSql("created_at")}
    `,
    [organizationIds, start, end, timeZone],
  )
  const row = result.rows[0]
  return {
    orders: number(row?.orders),
    completedOrders: number(row?.completed_orders),
    cancelledOrders: number(row?.cancelled_orders),
    revenue: round(number(row?.revenue)),
    paidRevenue: round(number(row?.paid_revenue)),
    unpaidRevenue: round(number(row?.unpaid_revenue)),
    averageTicket: round(number(row?.average_ticket)),
    discounts: round(number(row?.discounts)),
    deliveryRevenue: round(number(row?.delivery_revenue)),
  }
}

async function manualFinance(organizationIds: string[], start: string, end: string, timeZone: string) {
  const result = await getPostgresPool().query<FinanceRow>(
    `
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expenses
      FROM sf_financial_entries
      WHERE organization_id = ANY($1::uuid[])
        AND ${periodSql("created_at")}
    `,
    [organizationIds, start, end, timeZone],
  )
  const income = round(number(result.rows[0]?.income))
  const expenses = round(number(result.rows[0]?.expenses))
  return { income, expenses, result: round(income - expenses) }
}

async function products(organizationIds: string[], start: string, end: string, timeZone: string, totalRevenue: number) {
  const result = await getPostgresPool().query<ProductRow>(
    `
      SELECT
        oi.name,
        COALESCE(SUM(oi.quantity), 0)::int AS quantity,
        COALESCE(SUM(oi.subtotal), 0) AS revenue,
        COUNT(DISTINCT (oi.organization_id::text || ':' || oi.order_id::text))::int AS orders
      FROM sf_order_items oi
      INNER JOIN sf_orders o
        ON o.organization_id = oi.organization_id
       AND o.id = oi.order_id
      WHERE oi.organization_id = ANY($1::uuid[])
        AND o.status <> 'cancelled'
        AND ${periodSql("o.created_at")}
      GROUP BY oi.name
      ORDER BY revenue DESC, quantity DESC, oi.name ASC
      LIMIT 12
    `,
    [organizationIds, start, end, timeZone],
  )
  return result.rows.map<ReportProduct>((row) => ({
    name: row.name,
    quantity: number(row.quantity),
    revenue: round(number(row.revenue)),
    orders: number(row.orders),
    sharePercent: percent(number(row.revenue), totalRevenue),
  }))
}

async function breakdown(
  organizationIds: string[],
  start: string,
  end: string,
  timeZone: string,
  column: "channel" | "payment_method" | "type" | "status",
  totalRevenue: number,
) {
  const result = await getPostgresPool().query<BreakdownRow>(
    `
      SELECT
        ${column}::text AS key,
        COUNT(*)::int AS orders,
        COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0) AS revenue
      FROM sf_orders
      WHERE organization_id = ANY($1::uuid[])
        AND ${periodSql("created_at")}
      GROUP BY ${column}
      ORDER BY revenue DESC, orders DESC, key ASC
    `,
    [organizationIds, start, end, timeZone],
  )

  const labels: Record<string, string> = {
    WEB: "Loja online",
    PDV: "PDV",
    APP: "Aplicativo",
    card: "Cartão",
    cash: "Dinheiro",
    pix: "Pix",
    delivery: "Entrega",
    pickup: "Retirada",
    pending: "Pendente",
    accepted: "Aceito",
    preparing: "Preparando",
    ready: "Pronto",
    "in-route": "Em rota",
    completed: "Concluído",
    cancelled: "Cancelado",
  }

  return result.rows.map<ReportBreakdown>((row) => ({
    key: row.key,
    label: labels[row.key] || row.key,
    orders: number(row.orders),
    revenue: round(number(row.revenue)),
    sharePercent: percent(number(row.revenue), totalRevenue),
  }))
}

async function daily(organizationIds: string[], start: string, end: string, timeZone: string) {
  const result = await getPostgresPool().query<DailyRow>(
    `
      SELECT
        (created_at AT TIME ZONE $4)::date AS day,
        COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS orders,
        COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0) AS revenue,
        COALESCE(AVG(total) FILTER (WHERE status <> 'cancelled'), 0) AS average_ticket
      FROM sf_orders
      WHERE organization_id = ANY($1::uuid[])
        AND ${periodSql("created_at")}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    [organizationIds, start, end, timeZone],
  )
  return result.rows.map<ReportDailyPoint>((row) => ({
    date: dateOnly(row.day),
    orders: number(row.orders),
    revenue: round(number(row.revenue)),
    averageTicket: round(number(row.average_ticket)),
  }))
}

async function units(organizationIds: string[], start: string, end: string, timeZone: string, totalRevenue: number) {
  if (organizationIds.length <= 1) return [] as ReportUnit[]
  const result = await getPostgresPool().query<UnitRow>(
    `
      SELECT
        o.organization_id,
        org.trade_name AS name,
        COUNT(*) FILTER (WHERE o.status <> 'cancelled')::int AS orders,
        COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS revenue,
        COALESCE(AVG(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS average_ticket
      FROM sf_orders o
      INNER JOIN sf_organizations org ON org.id = o.organization_id
      WHERE o.organization_id = ANY($1::uuid[])
        AND ${periodSql("o.created_at")}
      GROUP BY o.organization_id, org.trade_name
      ORDER BY revenue DESC, orders DESC, org.trade_name ASC
    `,
    [organizationIds, start, end, timeZone],
  )
  return result.rows.map<ReportUnit>((row) => ({
    organizationId: row.organization_id,
    name: row.name,
    orders: number(row.orders),
    revenue: round(number(row.revenue)),
    averageTicket: round(number(row.average_ticket)),
    sharePercent: percent(number(row.revenue), totalRevenue),
  }))
}

async function customers(organizationIds: string[], start: string, end: string, timeZone: string) {
  const params = [organizationIds, start, end, timeZone]
  const keySql = `COALESCE(NULLIF(regexp_replace(COALESCE(customer->>'phone', ''), '[^0-9]', '', 'g'), ''), NULLIF(lower(customer->>'email'), ''), NULLIF(lower(customer->>'name'), ''))`
  const base = `
    WITH customer_orders AS (
      SELECT
        ${keySql} AS customer_key,
        MAX(COALESCE(NULLIF(customer->>'name', ''), 'Cliente')) AS name,
        COUNT(*)::int AS orders,
        COALESCE(SUM(total), 0) AS revenue,
        COALESCE(AVG(total), 0) AS average_ticket
      FROM sf_orders
      WHERE organization_id = ANY($1::uuid[])
        AND status <> 'cancelled'
        AND ${periodSql("created_at")}
      GROUP BY ${keySql}
    )
  `

  const [summaryResult, topResult] = await Promise.all([
    getPostgresPool().query<CustomerSummaryRow>(
      `${base}
       SELECT
         COUNT(*) FILTER (WHERE customer_key IS NOT NULL)::int AS identified_customers,
         COUNT(*) FILTER (WHERE customer_key IS NOT NULL AND orders > 1)::int AS returning_customers
       FROM customer_orders`,
      params,
    ),
    getPostgresPool().query<CustomerRow>(
      `${base}
       SELECT name, orders, revenue, average_ticket
       FROM customer_orders
       WHERE customer_key IS NOT NULL
       ORDER BY revenue DESC, orders DESC, name ASC
       LIMIT 10`,
      params,
    ),
  ])

  const identifiedCustomers = number(summaryResult.rows[0]?.identified_customers)
  const returningCustomers = number(summaryResult.rows[0]?.returning_customers)
  return {
    identifiedCustomers,
    returningCustomers,
    returningRatePercent: percent(returningCustomers, identifiedCustomers),
    top: topResult.rows.map<ReportCustomer>((row) => ({
      name: row.name,
      orders: number(row.orders),
      revenue: round(number(row.revenue)),
      averageTicket: round(number(row.average_ticket)),
    })),
  }
}

function buildInsights(report: Omit<ManagementReport, "insights">) {
  const insights: string[] = []
  const revenueDelta = report.comparison.revenue.percent
  if (revenueDelta !== null && Math.abs(revenueDelta) >= 5) {
    insights.push(`O faturamento ${revenueDelta >= 0 ? "cresceu" : "caiu"} ${Math.abs(revenueDelta).toFixed(1)}% em relação ao período anterior equivalente.`)
  }
  if (report.metrics.cancellationRatePercent >= 5) {
    insights.push(`A taxa de cancelamento está em ${report.metrics.cancellationRatePercent.toFixed(1)}%; vale revisar causas e etapas com maior perda.`)
  }
  if (report.metrics.revenue > 0 && report.metrics.unpaidRevenue / report.metrics.revenue >= 0.1) {
    insights.push(`Há ${percent(report.metrics.unpaidRevenue, report.metrics.revenue).toFixed(1)}% do faturamento do período marcado como não pago.`)
  }
  const top = report.products[0]
  if (top && top.sharePercent >= 35) {
    insights.push(`${top.name} concentra ${top.sharePercent.toFixed(1)}% do faturamento do período; acompanhe dependência e disponibilidade desse item.`)
  }
  if (report.customers.identifiedCustomers >= 5 && report.customers.returningRatePercent < 20) {
    insights.push(`A recorrência entre clientes identificados está em ${report.customers.returningRatePercent.toFixed(1)}%; há espaço para ações de recompra e fidelização.`)
  }
  if (!insights.length) insights.push("Os principais indicadores estão estáveis no período selecionado; use os rankings e comparativos para encontrar oportunidades específicas.")
  return insights.slice(0, 5)
}

export async function buildManagementReport(
  session: TenantAdminSession,
  requestedScope: ManagementReportScope,
  startRaw?: string | null,
  endRaw?: string | null,
): Promise<ManagementReport> {
  const period = normalizeReportPeriod(startRaw, endRaw)
  const scope = await reportScope(session, requestedScope)

  enterTenantRlsScope(
    scope.organizationIds,
    session.userId,
    requestedScope === "group" ? "corporate-report" : "tenant-session",
  )

  const timeZone = await organizationTimeZone(session.organizationId)

  const [current, previous, finance] = await Promise.all([
    summary(scope.organizationIds, period.start, period.end, timeZone),
    summary(scope.organizationIds, period.previousStart, period.previousEnd, timeZone),
    manualFinance(scope.organizationIds, period.start, period.end, timeZone),
  ])

  const [productRows, channels, payments, fulfillment, statuses, dailyRows, unitRows, customerData] = await Promise.all([
    products(scope.organizationIds, period.start, period.end, timeZone, current.revenue),
    breakdown(scope.organizationIds, period.start, period.end, timeZone, "channel", current.revenue),
    breakdown(scope.organizationIds, period.start, period.end, timeZone, "payment_method", current.revenue),
    breakdown(scope.organizationIds, period.start, period.end, timeZone, "type", current.revenue),
    breakdown(scope.organizationIds, period.start, period.end, timeZone, "status", current.revenue),
    daily(scope.organizationIds, period.start, period.end, timeZone),
    units(scope.organizationIds, period.start, period.end, timeZone, current.revenue),
    customers(scope.organizationIds, period.start, period.end, timeZone),
  ])

  const cancellationBase = current.orders + current.cancelledOrders
  const withoutInsights: Omit<ManagementReport, "insights"> = {
    ok: true,
    phase: "20-reports-intelligence",
    scope: { ...scope, timeZone },
    period,
    metrics: {
      ...current,
      cancellationRatePercent: percent(current.cancelledOrders, cancellationBase),
      manualIncome: finance.income,
      manualExpenses: finance.expenses,
      manualResult: finance.result,
    },
    comparison: {
      orders: { current: current.orders, previous: previous.orders, percent: deltaPercent(current.orders, previous.orders) },
      revenue: { current: current.revenue, previous: previous.revenue, percent: deltaPercent(current.revenue, previous.revenue) },
      averageTicket: { current: current.averageTicket, previous: previous.averageTicket, percent: deltaPercent(current.averageTicket, previous.averageTicket) },
      completedOrders: { current: current.completedOrders, previous: previous.completedOrders, percent: deltaPercent(current.completedOrders, previous.completedOrders) },
    },
    products: productRows,
    channels,
    payments,
    fulfillment,
    statuses,
    daily: dailyRows,
    units: unitRows,
    customers: customerData,
    boundaries: {
      readOnlyAnalytics: true,
      tenantIsolationPreserved: true,
      groupReadDoesNotGrantTenantWrite: true,
      financialDetailsRemainInDre: true,
      maxRangeDays: MAX_RANGE_DAYS,
    },
  }

  return { ...withoutInsights, insights: buildInsights(withoutInsights) }
}

export async function reportsSchemaHealth(session: TenantAdminSession): Promise<ReportsHealth> {
  const [tables, billing, corporate] = await Promise.all([
    getPostgresPool().query<{
      orders: string | null
      order_items: string | null
      financial_entries: string | null
      corporate_groups: string | null
    }>(`
      SELECT
        to_regclass('public.sf_orders')::text AS orders,
        to_regclass('public.sf_order_items')::text AS order_items,
        to_regclass('public.sf_financial_entries')::text AS financial_entries,
        to_regclass('public.sf_corporate_groups')::text AS corporate_groups
    `),
    getBillingSnapshotForOrganization(session.organizationId),
    getCorporateOverview(session).catch(() => null),
  ])
  const row = tables.rows[0]
  const subscriptionActive = billing.account?.status === "active" && billing.subscription?.status === "active"
  return {
    schemaReady: Boolean(row?.orders && row.order_items && row.financial_entries),
    entitlementEnabled: Boolean(billing.entitlements.advancedReports),
    subscriptionActive,
    groupAvailable: Boolean(corporate?.group && corporate.group.role && corporate.organizations.some((item) => item.inGroup)),
    sources: {
      orders: Boolean(row?.orders),
      orderItems: Boolean(row?.order_items),
      financialEntries: Boolean(row?.financial_entries),
      corporateGroups: Boolean(row?.corporate_groups),
    },
  }
}
