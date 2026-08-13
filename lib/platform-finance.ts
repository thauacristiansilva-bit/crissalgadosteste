import { randomUUID } from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"
import type { SuperadminAccess } from "@/lib/superadmin-auth"

export type PlatformFinanceEntry = {
  id: string
  competenceDate: string
  entryType: "revenue" | "expense"
  category: string
  description: string
  counterparty: string
  amountCents: number
  currency: string
  status: "planned" | "paid" | "canceled"
  dueDate: string | null
  paidAt: string | null
  notes: string
  createdAt: string
}

export type PlatformFinanceSnapshot = {
  month: string
  periodStart: string
  periodEnd: string
  dre: {
    revenueCents: number
    expenseCents: number
    resultCents: number
    paidExpensesCents: number
    plannedExpensesCents: number
  }
  contracted: {
    activeCommercialSubscriptions: number
    mrrCents: number
    arrCents: number
  }
  expensesByCategory: Array<{ category: string; amountCents: number }>
  entries: PlatformFinanceEntry[]
}

function parseMonth(input: string | null | undefined) {
  const value = String(input || "").trim()
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

function iso(value: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function dateOnly(value: Date | string | null) {
  if (!value) return null
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

async function recordFinanceAction(
  access: SuperadminAccess,
  action: string,
  targetId: string,
  metadata: Record<string, unknown>,
  ipAddress: string | null,
) {
  await getPostgresPool().query(
    `INSERT INTO sf_platform_admin_actions
       (id, platform_admin_id, action, target_type, target_id, metadata, ip_address)
     VALUES ($1, $2, $3, 'platform_finance_entry', $4, $5::jsonb, $6)`,
    [randomUUID(), access.platformAdminId, action, targetId, JSON.stringify(metadata), ipAddress],
  )
}

export async function getPlatformFinanceSnapshot(monthInput?: string | null): Promise<PlatformFinanceSnapshot> {
  const month = parseMonth(monthInput)
  const start = `${month}-01`
  const pool = getPostgresPool()

  const [summary, contracted, categories, entries] = await Promise.all([
    pool.query<{
      revenue_cents: string
      expense_cents: string
      paid_expenses_cents: string
      planned_expenses_cents: string
    }>(
      `SELECT
         COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'revenue' AND status <> 'canceled'), 0)::text AS revenue_cents,
         COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'expense' AND status <> 'canceled'), 0)::text AS expense_cents,
         COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'expense' AND status = 'paid'), 0)::text AS paid_expenses_cents,
         COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'expense' AND status = 'planned'), 0)::text AS planned_expenses_cents
       FROM sf_platform_finance_entries
       WHERE competence_date >= $1::date
         AND competence_date < ($1::date + interval '1 month')`,
      [start],
    ),
    pool.query<{ active_subscriptions: string; mrr_cents: string }>(
      `SELECT
         COUNT(s.id)::text AS active_subscriptions,
         COALESCE(SUM(
           CASE
             WHEN s.billing_cycle = 'monthly' THEN COALESCE(p.monthly_price_cents, 0)
             WHEN s.billing_cycle = 'annual' THEN ROUND(COALESCE(p.annual_price_cents, 0) / 12.0)::integer
             ELSE 0
           END
         ), 0)::text AS mrr_cents
       FROM sf_subscriptions s
       INNER JOIN sf_plans p ON p.id = s.plan_id
       WHERE s.status = 'active'
         AND p.active = true
         AND p.internal = false`,
    ),
    pool.query<{ category: string; amount_cents: string }>(
      `SELECT category, COALESCE(SUM(amount_cents), 0)::text AS amount_cents
       FROM sf_platform_finance_entries
       WHERE competence_date >= $1::date
         AND competence_date < ($1::date + interval '1 month')
         AND entry_type = 'expense'
         AND status <> 'canceled'
       GROUP BY category
       ORDER BY SUM(amount_cents) DESC, category ASC`,
      [start],
    ),
    pool.query<{
      id: string
      competence_date: Date | string
      entry_type: "revenue" | "expense"
      category: string
      description: string
      counterparty: string
      amount_cents: number
      currency: string
      status: "planned" | "paid" | "canceled"
      due_date: Date | string | null
      paid_at: Date | string | null
      notes: string
      created_at: Date | string
    }>(
      `SELECT id, competence_date, entry_type, category, description, counterparty,
              amount_cents, currency, status, due_date, paid_at, notes, created_at
       FROM sf_platform_finance_entries
       WHERE competence_date >= $1::date
         AND competence_date < ($1::date + interval '1 month')
       ORDER BY competence_date DESC, created_at DESC
       LIMIT 500`,
      [start],
    ),
  ])

  const row = summary.rows[0]
  const revenueCents = Number(row?.revenue_cents || 0)
  const expenseCents = Number(row?.expense_cents || 0)
  const mrrCents = Number(contracted.rows[0]?.mrr_cents || 0)
  const periodEnd = new Date(`${start}T00:00:00.000Z`)
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)

  return {
    month,
    periodStart: start,
    periodEnd: periodEnd.toISOString().slice(0, 10),
    dre: {
      revenueCents,
      expenseCents,
      resultCents: revenueCents - expenseCents,
      paidExpensesCents: Number(row?.paid_expenses_cents || 0),
      plannedExpensesCents: Number(row?.planned_expenses_cents || 0),
    },
    contracted: {
      activeCommercialSubscriptions: Number(contracted.rows[0]?.active_subscriptions || 0),
      mrrCents,
      arrCents: mrrCents * 12,
    },
    expensesByCategory: categories.rows.map((item) => ({
      category: item.category,
      amountCents: Number(item.amount_cents || 0),
    })),
    entries: entries.rows.map((entry) => ({
      id: entry.id,
      competenceDate: dateOnly(entry.competence_date) || start,
      entryType: entry.entry_type,
      category: entry.category,
      description: entry.description,
      counterparty: entry.counterparty,
      amountCents: Number(entry.amount_cents || 0),
      currency: entry.currency,
      status: entry.status,
      dueDate: dateOnly(entry.due_date),
      paidAt: iso(entry.paid_at),
      notes: entry.notes,
      createdAt: iso(entry.created_at) || "",
    })),
  }
}

export async function createPlatformFinanceEntry(
  access: SuperadminAccess,
  input: {
    competenceDate: string
    entryType: "revenue" | "expense"
    category: string
    description: string
    counterparty?: string
    amountCents: number
    status?: "planned" | "paid"
    dueDate?: string | null
    notes?: string
  },
  ipAddress: string | null,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.competenceDate)) throw new Error("Competência inválida.")
  if (!input.category.trim()) throw new Error("Informe a categoria.")
  if (!input.description.trim()) throw new Error("Informe a descrição.")
  const amountCents = Math.round(Number(input.amountCents))
  if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error("Valor inválido.")
  const status = input.status === "paid" ? "paid" : "planned"
  const id = randomUUID()

  await getPostgresPool().query(
    `INSERT INTO sf_platform_finance_entries (
       id, competence_date, entry_type, category, description, counterparty,
       amount_cents, status, due_date, paid_at, notes,
       created_by_platform_admin_id, updated_by_platform_admin_id
     ) VALUES (
       $1, $2::date, $3, $4, $5, $6,
       $7, $8, $9::date, CASE WHEN $8 = 'paid' THEN now() ELSE NULL END, $10,
       $11, $11
     )`,
    [
      id,
      input.competenceDate,
      input.entryType,
      input.category.trim().slice(0, 80),
      input.description.trim().slice(0, 240),
      String(input.counterparty || "").trim().slice(0, 160),
      amountCents,
      status,
      input.dueDate || null,
      String(input.notes || "").trim().slice(0, 1000),
      access.platformAdminId,
    ],
  )

  await recordFinanceAction(access, "platform_finance.create", id, {
    entryType: input.entryType,
    amountCents,
    category: input.category,
    competenceDate: input.competenceDate,
  }, ipAddress)

  return id
}

export async function setPlatformFinanceEntryStatus(
  access: SuperadminAccess,
  entryId: string,
  status: "planned" | "paid" | "canceled",
  ipAddress: string | null,
) {
  const result = await getPostgresPool().query(
    `UPDATE sf_platform_finance_entries
     SET status = $2,
         paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, now()) ELSE NULL END,
         updated_by_platform_admin_id = $3,
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [entryId, status, access.platformAdminId],
  )
  if (!result.rowCount) throw new Error("Lançamento financeiro não encontrado.")
  await recordFinanceAction(access, "platform_finance.status", entryId, { status }, ipAddress)
}
