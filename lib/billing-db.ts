import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import type {
  BillingSnapshot,
  PlanEntitlementKey,
  PlanEntitlements,
  SubscriptionStatus,
} from "@/lib/billing-types"

const defaultEntitlements: PlanEntitlements = {
  maxOrganizations: 0,
  maxUsers: 0,
  maxProducts: 0,
  customDomain: false,
  delivery: false,
  kitchen: false,
  financial: false,
  loyalty: false,
  modifiers: false,
  inventory: false,
  advancedReports: false,
  integrations: false,
}

export class BillingAccessError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status = 403) {
    super(message)
    this.name = "BillingAccessError"
    this.code = code
    this.status = status
  }
}

type BillingRow = {
  account_id: string
  account_status: "active" | "suspended" | "closed"
  billing_email: string | null
  entitlement_overrides: Record<string, unknown> | null
  subscription_id: string | null
  subscription_status: SubscriptionStatus | null
  plan_id: string | null
  plan_code: string | null
  plan_name: string | null
  plan_internal: boolean | null
  current_period_end: Date | string | null
  trial_ends_at: Date | string | null
  billing_cycle: "monthly" | "annual" | "manual" | null
  provider: string | null
}

function toIso(value: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function numericLimit(value: unknown): number | null {
  if (value === null || typeof value === "undefined") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.floor(parsed)
}

function boolValue(value: unknown) {
  return value === true
}

function mergeEntitlements(
  rows: Array<{ entitlement_key: PlanEntitlementKey; entitlement_value: unknown }>,
  overrides: Record<string, unknown> | null,
): PlanEntitlements {
  const raw: Record<string, unknown> = {}
  for (const row of rows) raw[row.entitlement_key] = row.entitlement_value
  for (const [key, value] of Object.entries(overrides || {})) raw[key] = value

  return {
    maxOrganizations: numericLimit(raw.maxOrganizations),
    maxUsers: numericLimit(raw.maxUsers),
    maxProducts: numericLimit(raw.maxProducts),
    customDomain: boolValue(raw.customDomain),
    delivery: boolValue(raw.delivery),
    kitchen: boolValue(raw.kitchen),
    financial: boolValue(raw.financial),
    loyalty: boolValue(raw.loyalty),
    modifiers: boolValue(raw.modifiers),
    inventory: boolValue(raw.inventory),
    advancedReports: boolValue(raw.advancedReports),
    integrations: boolValue(raw.integrations),
  }
}

async function accountRowForUser(client: PoolClient, userId: string, lock = false) {
  const result = await client.query<BillingRow>(
    `
      SELECT
        ba.id AS account_id,
        ba.status AS account_status,
        ba.billing_email,
        ba.entitlement_overrides,
        s.id AS subscription_id,
        s.status AS subscription_status,
        p.id AS plan_id,
        p.code AS plan_code,
        p.name AS plan_name,
        p.internal AS plan_internal,
        s.current_period_end,
        s.trial_ends_at,
        s.billing_cycle,
        s.provider
      FROM sf_billing_accounts ba
      LEFT JOIN LATERAL (
        SELECT current_subscription.*
        FROM sf_subscriptions current_subscription
        WHERE current_subscription.billing_account_id = ba.id
          AND current_subscription.status <> 'canceled'
        ORDER BY
          CASE current_subscription.status
            WHEN 'active' THEN 1
            WHEN 'trialing' THEN 2
            WHEN 'past_due' THEN 3
            WHEN 'suspended' THEN 4
            WHEN 'pending' THEN 5
            ELSE 6
          END,
          current_subscription.created_at DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN sf_plans p ON p.id = s.plan_id
      WHERE ba.owner_user_id = $1
      LIMIT 1
      ${lock ? "FOR UPDATE OF ba" : ""}
    `,
    [userId],
  )
  return result.rows[0] || null
}

async function accountRowForOrganization(client: PoolClient, organizationId: string) {
  const result = await client.query<BillingRow>(
    `
      SELECT
        ba.id AS account_id,
        ba.status AS account_status,
        ba.billing_email,
        ba.entitlement_overrides,
        s.id AS subscription_id,
        s.status AS subscription_status,
        p.id AS plan_id,
        p.code AS plan_code,
        p.name AS plan_name,
        p.internal AS plan_internal,
        s.current_period_end,
        s.trial_ends_at,
        s.billing_cycle,
        s.provider
      FROM sf_organizations o
      INNER JOIN sf_billing_accounts ba ON ba.id = o.billing_account_id
      LEFT JOIN LATERAL (
        SELECT current_subscription.*
        FROM sf_subscriptions current_subscription
        WHERE current_subscription.billing_account_id = ba.id
          AND current_subscription.status <> 'canceled'
        ORDER BY
          CASE current_subscription.status
            WHEN 'active' THEN 1
            WHEN 'trialing' THEN 2
            WHEN 'past_due' THEN 3
            WHEN 'suspended' THEN 4
            WHEN 'pending' THEN 5
            ELSE 6
          END,
          current_subscription.created_at DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN sf_plans p ON p.id = s.plan_id
      WHERE o.id = $1
      LIMIT 1
    `,
    [organizationId],
  )
  return result.rows[0] || null
}

async function planEntitlements(client: PoolClient, row: BillingRow | null) {
  if (!row?.plan_id) return { ...defaultEntitlements }
  const result = await client.query<{
    entitlement_key: PlanEntitlementKey
    entitlement_value: unknown
  }>(
    `
      SELECT entitlement_key, entitlement_value
      FROM sf_plan_entitlements
      WHERE plan_id = $1
    `,
    [row.plan_id],
  )
  return mergeEntitlements(result.rows, row.entitlement_overrides)
}

async function usageForAccount(
  client: PoolClient,
  accountId: string,
  organizationId?: string,
) {
  // sf_organizations é a âncora da conta de cobrança e não é uma tabela tenant
  // com organization_id. Primeiro derivamos, no backend, o conjunto exato de
  // organizações que pertencem à conta. Esse conjunto vira o escopo RLS
  // explícito usado apenas para calcular consumo comercial da própria conta.
  const organizations = await client.query<{ id: string }>(
    `
      SELECT id
      FROM sf_organizations
      WHERE billing_account_id = $1
        AND status <> 'cancelled'
      ORDER BY created_at ASC, id ASC
    `,
    [accountId],
  )

  const organizationIds = organizations.rows.map((row) => row.id)

  const scopedUsage = await runWithTenantRlsScope(
    organizationIds,
    undefined,
    async () => {
      const pool = getPostgresPool()

      const users = await pool.query<{ count: string }>(
        `
          SELECT COUNT(DISTINCT m.user_id)::text AS count
          FROM sf_memberships m
          INNER JOIN sf_organizations o ON o.id = m.organization_id
          WHERE o.billing_account_id = $1
            AND o.status <> 'cancelled'
            AND m.status IN ('active', 'invited')
        `,
        [accountId],
      )

      const products = organizationId
        ? await pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM sf_products WHERE organization_id = $1`,
            [organizationId],
          )
        : { rows: [{ count: "0" }] }

      return {
        users: Number(users.rows[0]?.count || 0),
        products: Number(products.rows[0]?.count || 0),
      }
    },
  )

  return {
    organizations: organizationIds.length,
    users: scopedUsage.users,
    products: scopedUsage.products,
  }
}

function belowLimit(used: number, limit: number | null) {
  return limit === null || used < limit
}

function assertActive(row: BillingRow | null) {
  if (!row) {
    throw new BillingAccessError(
      "Esta conta ainda não possui uma conta de cobrança. Conclua a contratação para continuar.",
      "billing_account_required",
      402,
    )
  }
  if (row.account_status !== "active") {
    throw new BillingAccessError(
      "A conta comercial está suspensa. Regularize a assinatura para continuar.",
      "billing_account_suspended",
      402,
    )
  }
  if (row.subscription_status !== "active") {
    throw new BillingAccessError(
      "É necessária uma assinatura ativa para usar este recurso.",
      "active_subscription_required",
      402,
    )
  }
}

export async function getBillingSnapshotForOrganization(
  organizationId: string,
): Promise<BillingSnapshot> {
  const client = await getPostgresPool().connect()
  try {
    const row = await accountRowForOrganization(client, organizationId)
    if (!row) {
      return {
        ready: false,
        account: null,
        subscription: null,
        entitlements: { ...defaultEntitlements },
        usage: { organizations: 0, users: 0, products: 0 },
        capacity: {
          canCreateOrganization: false,
          canAddUser: false,
          canCreateProduct: false,
        },
      }
    }
    const entitlements = await planEntitlements(client, row)
    const usage = await usageForAccount(client, row.account_id, organizationId)
    const active = row.account_status === "active" && row.subscription_status === "active"
    return {
      ready: true,
      account: {
        id: row.account_id,
        status: row.account_status,
        billingEmail: row.billing_email,
      },
      subscription: row.subscription_id && row.plan_id && row.plan_code && row.plan_name && row.subscription_status
        ? {
            id: row.subscription_id,
            status: row.subscription_status,
            planId: row.plan_id,
            planCode: row.plan_code,
            planName: row.plan_name,
            internal: Boolean(row.plan_internal),
            billingCycle: row.billing_cycle,
            provider: row.provider,
            currentPeriodEnd: toIso(row.current_period_end),
            trialEndsAt: toIso(row.trial_ends_at),
          }
        : null,
      entitlements,
      usage,
      capacity: {
        canCreateOrganization: active && belowLimit(usage.organizations, entitlements.maxOrganizations),
        canAddUser: active && belowLimit(usage.users, entitlements.maxUsers),
        canCreateProduct: active && belowLimit(usage.products, entitlements.maxProducts),
      },
    }
  } finally {
    client.release()
  }
}

export async function getBillingSnapshotForUser(
  userId: string,
  organizationId?: string,
): Promise<BillingSnapshot> {
  const client = await getPostgresPool().connect()
  try {
    const row = await accountRowForUser(client, userId)
    if (!row) {
      return {
        ready: false,
        account: null,
        subscription: null,
        entitlements: { ...defaultEntitlements },
        usage: { organizations: 0, users: 0, products: 0 },
        capacity: { canCreateOrganization: false, canAddUser: false, canCreateProduct: false },
      }
    }
    const entitlements = await planEntitlements(client, row)
    const usage = await usageForAccount(client, row.account_id, organizationId)
    const active = row.account_status === "active" && row.subscription_status === "active"
    return {
      ready: true,
      account: { id: row.account_id, status: row.account_status, billingEmail: row.billing_email },
      subscription: row.subscription_id && row.plan_id && row.plan_code && row.plan_name && row.subscription_status
        ? {
            id: row.subscription_id,
            status: row.subscription_status,
            planId: row.plan_id,
            planCode: row.plan_code,
            planName: row.plan_name,
            internal: Boolean(row.plan_internal),
            billingCycle: row.billing_cycle,
            provider: row.provider,
            currentPeriodEnd: toIso(row.current_period_end),
            trialEndsAt: toIso(row.trial_ends_at),
          }
        : null,
      entitlements,
      usage,
      capacity: {
        canCreateOrganization: active && belowLimit(usage.organizations, entitlements.maxOrganizations),
        canAddUser: active && belowLimit(usage.users, entitlements.maxUsers),
        canCreateProduct: active && belowLimit(usage.products, entitlements.maxProducts),
      },
    }
  } finally {
    client.release()
  }
}

export async function reserveOrganizationSlot(
  client: PoolClient,
  userId: string,
) {
  const row = await accountRowForUser(client, userId, true)
  assertActive(row)
  const entitlements = await planEntitlements(client, row)
  const usage = await usageForAccount(client, row!.account_id)
  if (!belowLimit(usage.organizations, entitlements.maxOrganizations)) {
    throw new BillingAccessError(
      `Seu plano permite ${entitlements.maxOrganizations ?? "ilimitadas"} loja(s) e o limite já foi atingido. Faça upgrade para adicionar outra loja.`,
      "max_organizations_reached",
      409,
    )
  }
  return { billingAccountId: row!.account_id, entitlements, usage }
}


export async function assertActiveSubscriptionForOrganization(organizationId: string) {
  const snapshot = await getBillingSnapshotForOrganization(organizationId)
  if (!snapshot.account || snapshot.account.status !== "active" || snapshot.subscription?.status !== "active") {
    throw new BillingAccessError(
      "É necessária uma assinatura ativa para operar esta loja.",
      "active_subscription_required",
      402,
    )
  }
  return snapshot
}

export async function assertCanAddUser(organizationId: string) {
  const snapshot = await getBillingSnapshotForOrganization(organizationId)
  if (!snapshot.account || snapshot.subscription?.status !== "active") {
    throw new BillingAccessError("É necessária uma assinatura ativa para criar acessos de equipe.", "active_subscription_required", 402)
  }
  if (!snapshot.capacity.canAddUser) {
    throw new BillingAccessError("O limite de usuários do plano foi atingido. Faça upgrade para adicionar outro acesso.", "max_users_reached", 409)
  }
  return snapshot
}

export async function assertCanCreateProduct(organizationId: string) {
  const snapshot = await getBillingSnapshotForOrganization(organizationId)
  if (!snapshot.account || snapshot.subscription?.status !== "active") {
    throw new BillingAccessError("É necessária uma assinatura ativa para cadastrar produtos.", "active_subscription_required", 402)
  }
  if (!snapshot.capacity.canCreateProduct) {
    throw new BillingAccessError("O limite de produtos do plano foi atingido. Faça upgrade para cadastrar outro produto.", "max_products_reached", 409)
  }
  return snapshot
}

export async function assertOrganizationEntitlement(
  organizationId: string,
  key: Exclude<PlanEntitlementKey, "maxOrganizations" | "maxUsers" | "maxProducts">,
) {
  const snapshot = await getBillingSnapshotForOrganization(organizationId)
  if (!snapshot.account || snapshot.subscription?.status !== "active") {
    throw new BillingAccessError("É necessária uma assinatura ativa para usar este recurso.", "active_subscription_required", 402)
  }
  if (!snapshot.entitlements[key]) {
    throw new BillingAccessError("Este recurso não está incluído no plano atual.", `entitlement_${key}_required`, 403)
  }
  return snapshot
}

export function billingErrorStatus(error: unknown) {
  return error instanceof BillingAccessError ? error.status : 400
}
