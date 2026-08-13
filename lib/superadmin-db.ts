import { randomUUID } from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"
import type { PlanEntitlementKey } from "@/lib/billing-types"
import { PLAN_ENTITLEMENT_KEYS } from "@/lib/billing-types"
import type { SuperadminAccess } from "@/lib/superadmin-auth"

export type SuperadminSnapshot = {
  generatedAt: string
  metrics: {
    users: number
    billingAccounts: number
    organizations: number
    activeSubscriptions: number
    pastDueSubscriptions: number
    activeTrials: number
    activeDemos: number
    openSupportCases: number
    pendingRegistrations: number
    contractedMrrCents: number
  }
  registrations: Array<{
    id: string
    billingAccountId: string
    ownerName: string
    ownerEmail: string
    status: "pending" | "approved" | "rejected"
    notes: string
    reviewedAt: string | null
    createdAt: string
    organizations: number
    subscriptionStatus: string | null
    planName: string | null
  }>
  accounts: Array<{
    id: string
    ownerEmail: string | null
    status: string
    organizations: number
    subscriptionId: string | null
    subscriptionStatus: string | null
    planId: string | null
    planCode: string | null
    planName: string | null
    provider: string | null
    currentPeriodEnd: string | null
    overrides: Record<string, unknown>
  }>
  organizations: Array<{
    id: string
    name: string
    slug: string
    status: string
    billingAccountId: string | null
    publicStoreEnabled: boolean
    createdAt: string
  }>
  plans: Array<{
    id: string
    code: string
    name: string
    active: boolean
    internal: boolean
    checkoutEnabled: boolean
    monthlyPriceCents: number | null
    annualPriceCents: number | null
    activeSubscriptions: number
    mrrCents: number
  }>
  checkouts: Array<{
    id: string
    billingAccountId: string
    provider: string
    status: string
    amountCents: number
    currency: string
    createdAt: string
  }>
  demos: Array<{
    id: string
    kind: string
    status: string
    organizationId: string
    organizationName: string
    expiresAt: string
  }>
  domains: Array<{
    id: string
    organizationName: string
    domain: string
    verified: boolean
  }>
  coupons: Array<{
    id: string
    code: string
    description: string
    discountType: string
    discountValue: number
    active: boolean
    validUntil: string | null
  }>
  support: Array<{
    id: string
    subject: string
    priority: string
    status: string
    organizationName: string | null
    billingEmail: string | null
    updatedAt: string
  }>
  logs: Array<{
    id: string
    adminEmail: string
    action: string
    targetType: string
    targetId: string
    createdAt: string
  }>
}

function iso(value: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function count(row: { count?: string } | undefined) {
  return Number(row?.count || 0)
}

export async function getSuperadminSnapshot(): Promise<SuperadminSnapshot> {
  const pool = getPostgresPool()
  const [users, accountsCount, organizationsCount, activeSubs, pastDueSubs, trials, demosCount, supportCount, pendingRegistrations, registrations, accounts, organizations, plans, checkouts, demos, domains, coupons, support, logs] = await Promise.all([
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM sf_users WHERE status <> 'blocked'`),
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM sf_billing_accounts WHERE status <> 'closed' AND COALESCE(metadata->>'demo', 'false') <> 'true'`),
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM sf_organizations o WHERE o.status <> 'cancelled' AND NOT EXISTS (SELECT 1 FROM sf_demo_environments d WHERE d.organization_id = o.id)`),
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM sf_subscriptions s INNER JOIN sf_plans p ON p.id = s.plan_id WHERE s.status = 'active' AND p.internal = false`),
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM sf_subscriptions s INNER JOIN sf_plans p ON p.id = s.plan_id WHERE s.status IN ('past_due', 'suspended') AND p.internal = false`),
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM sf_demo_environments WHERE kind = 'trial' AND status = 'active' AND expires_at > now()`),
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM sf_demo_environments WHERE kind = 'public' AND status = 'active' AND expires_at > now()`),
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM sf_support_cases WHERE status IN ('open', 'pending')`),
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM sf_platform_registration_reviews WHERE status = 'pending'`),
    pool.query<{
      id: string; billing_account_id: string; owner_name: string; owner_email: string; status: "pending" | "approved" | "rejected";
      notes: string; reviewed_at: Date | string | null; created_at: Date | string; organization_count: string;
      subscription_status: string | null; plan_name: string | null
    }>(`
      SELECT r.id, r.billing_account_id, u.name AS owner_name, u.email AS owner_email, r.status, r.notes,
             r.reviewed_at, r.created_at,
             (SELECT COUNT(*)::text FROM sf_organizations o WHERE o.billing_account_id = ba.id AND o.status <> 'cancelled') AS organization_count,
             s.status AS subscription_status, p.name AS plan_name
      FROM sf_platform_registration_reviews r
      INNER JOIN sf_billing_accounts ba ON ba.id = r.billing_account_id
      INNER JOIN sf_users u ON u.id = ba.owner_user_id
      LEFT JOIN LATERAL (
        SELECT sx.* FROM sf_subscriptions sx
        WHERE sx.billing_account_id = ba.id AND sx.status <> 'canceled'
        ORDER BY CASE sx.status WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 WHEN 'past_due' THEN 3 WHEN 'suspended' THEN 4 ELSE 5 END,
                 sx.created_at DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN sf_plans p ON p.id = s.plan_id
      WHERE COALESCE(ba.metadata->>'demo', 'false') <> 'true'
      ORDER BY CASE r.status WHEN 'pending' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, r.created_at DESC
      LIMIT 200
    `),
    pool.query<{
      id: string; owner_email: string | null; status: string; organization_count: string;
      subscription_id: string | null; subscription_status: string | null; plan_id: string | null;
      plan_code: string | null; plan_name: string | null; provider: string | null;
      current_period_end: Date | string | null; entitlement_overrides: Record<string, unknown> | null
    }>(`
      SELECT ba.id, u.email AS owner_email, ba.status,
        (SELECT COUNT(*)::text FROM sf_organizations o WHERE o.billing_account_id = ba.id AND o.status <> 'cancelled') AS organization_count,
        s.id AS subscription_id, s.status AS subscription_status, p.id AS plan_id,
        p.code AS plan_code, p.name AS plan_name, s.provider, s.current_period_end,
        ba.entitlement_overrides
      FROM sf_billing_accounts ba
      INNER JOIN sf_users u ON u.id = ba.owner_user_id
      LEFT JOIN LATERAL (
        SELECT sx.* FROM sf_subscriptions sx
        WHERE sx.billing_account_id = ba.id AND sx.status <> 'canceled'
        ORDER BY CASE sx.status WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 WHEN 'past_due' THEN 3 WHEN 'suspended' THEN 4 ELSE 5 END,
                 sx.created_at DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN sf_plans p ON p.id = s.plan_id
      WHERE COALESCE(ba.metadata->>'demo', 'false') <> 'true'
      ORDER BY ba.created_at DESC
      LIMIT 200
    `),
    pool.query<{ id: string; trade_name: string; slug: string; status: string; billing_account_id: string | null; public_store_enabled: boolean; created_at: Date | string }>(`
      SELECT o.id, o.trade_name, o.slug, o.status, o.billing_account_id, o.public_store_enabled, o.created_at
      FROM sf_organizations o
      WHERE NOT EXISTS (SELECT 1 FROM sf_demo_environments d WHERE d.organization_id = o.id)
      ORDER BY o.created_at DESC LIMIT 200
    `),
    pool.query<{ id: string; code: string; name: string; active: boolean; internal: boolean; checkout_enabled: boolean; monthly_price_cents: number | null; annual_price_cents: number | null; active_subscriptions: string; mrr_cents: string }>(`
      SELECT p.id, p.code, p.name, p.active, p.internal, p.checkout_enabled, p.monthly_price_cents, p.annual_price_cents,
             COUNT(s.id) FILTER (WHERE s.status = 'active')::text AS active_subscriptions,
             COALESCE(SUM(
               CASE
                 WHEN s.status <> 'active' OR p.internal THEN 0
                 WHEN s.billing_cycle = 'monthly' THEN COALESCE(p.monthly_price_cents, 0)
                 WHEN s.billing_cycle = 'annual' THEN ROUND(COALESCE(p.annual_price_cents, 0) / 12.0)::integer
                 ELSE 0
               END
             ), 0)::text AS mrr_cents
      FROM sf_plans p
      LEFT JOIN sf_subscriptions s ON s.plan_id = p.id
      GROUP BY p.id, p.code, p.name, p.active, p.internal, p.checkout_enabled, p.monthly_price_cents, p.annual_price_cents, p.sort_order
      ORDER BY p.internal ASC, p.sort_order ASC, p.name ASC
    `),
    pool.query<{ id: string; billing_account_id: string; provider: string; status: string; amount_cents: number; currency: string; created_at: Date | string }>(`
      SELECT id, billing_account_id, provider, status, amount_cents, currency, created_at
      FROM sf_checkout_sessions ORDER BY created_at DESC LIMIT 100
    `),
    pool.query<{ id: string; kind: string; status: string; organization_id: string; organization_name: string; expires_at: Date | string }>(`
      SELECT d.id, d.kind, d.status, d.organization_id, o.trade_name AS organization_name, d.expires_at
      FROM sf_demo_environments d INNER JOIN sf_organizations o ON o.id = d.organization_id
      ORDER BY d.created_at DESC LIMIT 100
    `),
    pool.query<{ id: string; organization_name: string; domain: string; verified: boolean }>(`
      SELECT d.domain AS id, o.trade_name AS organization_name, d.domain, d.verified
      FROM sf_organization_domains d INNER JOIN sf_organizations o ON o.id = d.organization_id
      ORDER BY d.created_at DESC LIMIT 100
    `),
    pool.query<{ id: string; code: string; description: string; discount_type: string; discount_value: number; active: boolean; valid_until: Date | string | null }>(`
      SELECT id, code, description, discount_type, discount_value, active, valid_until
      FROM sf_commercial_coupons ORDER BY created_at DESC LIMIT 100
    `),
    pool.query<{ id: string; subject: string; priority: string; status: string; organization_name: string | null; billing_email: string | null; updated_at: Date | string }>(`
      SELECT sc.id, sc.subject, sc.priority, sc.status, o.trade_name AS organization_name,
             ba.billing_email, sc.updated_at
      FROM sf_support_cases sc
      LEFT JOIN sf_organizations o ON o.id = sc.organization_id
      LEFT JOIN sf_billing_accounts ba ON ba.id = sc.billing_account_id
      ORDER BY CASE sc.status WHEN 'open' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, sc.updated_at DESC
      LIMIT 100
    `),
    pool.query<{ id: string; admin_email: string; action: string; target_type: string; target_id: string; created_at: Date | string }>(`
      SELECT a.id, u.email AS admin_email, a.action, a.target_type, a.target_id, a.created_at
      FROM sf_platform_admin_actions a
      INNER JOIN sf_platform_admins pa ON pa.id = a.platform_admin_id
      INNER JOIN sf_users u ON u.id = pa.user_id
      ORDER BY a.created_at DESC LIMIT 100
    `),
  ])

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      users: count(users.rows[0]),
      billingAccounts: count(accountsCount.rows[0]),
      organizations: count(organizationsCount.rows[0]),
      activeSubscriptions: count(activeSubs.rows[0]),
      pastDueSubscriptions: count(pastDueSubs.rows[0]),
      activeTrials: count(trials.rows[0]),
      activeDemos: count(demosCount.rows[0]),
      openSupportCases: count(supportCount.rows[0]),
      pendingRegistrations: count(pendingRegistrations.rows[0]),
      contractedMrrCents: plans.rows.reduce((sum, plan) => sum + Number(plan.mrr_cents || 0), 0),
    },
    registrations: registrations.rows.map((r) => ({
      id: r.id, billingAccountId: r.billing_account_id, ownerName: r.owner_name, ownerEmail: r.owner_email,
      status: r.status, notes: r.notes, reviewedAt: iso(r.reviewed_at), createdAt: iso(r.created_at) || "",
      organizations: Number(r.organization_count || 0), subscriptionStatus: r.subscription_status, planName: r.plan_name,
    })),
    accounts: accounts.rows.map((r) => ({
      id: r.id, ownerEmail: r.owner_email, status: r.status, organizations: Number(r.organization_count || 0),
      subscriptionId: r.subscription_id, subscriptionStatus: r.subscription_status, planId: r.plan_id,
      planCode: r.plan_code, planName: r.plan_name, provider: r.provider,
      currentPeriodEnd: iso(r.current_period_end), overrides: r.entitlement_overrides || {},
    })),
    organizations: organizations.rows.map((r) => ({
      id: r.id, name: r.trade_name, slug: r.slug, status: r.status, billingAccountId: r.billing_account_id,
      publicStoreEnabled: Boolean(r.public_store_enabled), createdAt: iso(r.created_at) || "",
    })),
    plans: plans.rows.map((r) => ({
      id: r.id, code: r.code, name: r.name, active: Boolean(r.active), internal: Boolean(r.internal),
      checkoutEnabled: Boolean(r.checkout_enabled), monthlyPriceCents: r.monthly_price_cents, annualPriceCents: r.annual_price_cents,
      activeSubscriptions: Number(r.active_subscriptions || 0), mrrCents: Number(r.mrr_cents || 0),
    })),
    checkouts: checkouts.rows.map((r) => ({
      id: r.id, billingAccountId: r.billing_account_id, provider: r.provider, status: r.status,
      amountCents: Number(r.amount_cents), currency: r.currency, createdAt: iso(r.created_at) || "",
    })),
    demos: demos.rows.map((r) => ({
      id: r.id, kind: r.kind, status: r.status, organizationId: r.organization_id,
      organizationName: r.organization_name, expiresAt: iso(r.expires_at) || "",
    })),
    domains: domains.rows.map((r) => ({
      id: r.id, organizationName: r.organization_name, domain: r.domain, verified: Boolean(r.verified),
    })),
    coupons: coupons.rows.map((r) => ({
      id: r.id, code: r.code, description: r.description, discountType: r.discount_type,
      discountValue: Number(r.discount_value), active: Boolean(r.active), validUntil: iso(r.valid_until),
    })),
    support: support.rows.map((r) => ({
      id: r.id, subject: r.subject, priority: r.priority, status: r.status,
      organizationName: r.organization_name, billingEmail: r.billing_email, updatedAt: iso(r.updated_at) || "",
    })),
    logs: logs.rows.map((r) => ({
      id: r.id, adminEmail: r.admin_email, action: r.action, targetType: r.target_type,
      targetId: r.target_id, createdAt: iso(r.created_at) || "",
    })),
  }
}

async function recordAction(access: SuperadminAccess, action: string, targetType: string, targetId: string, metadata: Record<string, unknown>, ipAddress: string | null) {
  await getPostgresPool().query(
    `INSERT INTO sf_platform_admin_actions (id, platform_admin_id, action, target_type, target_id, metadata, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [randomUUID(), access.platformAdminId, action, targetType, targetId, JSON.stringify(metadata), ipAddress],
  )
}

export async function setRegistrationReview(
  access: SuperadminAccess,
  billingAccountId: string,
  status: "approved" | "rejected",
  notes: string,
  ipAddress: string | null,
) {
  const result = await getPostgresPool().query(
    `UPDATE sf_platform_registration_reviews
     SET status = $2, notes = $3, reviewed_by_platform_admin_id = $4, reviewed_at = now(), updated_at = now()
     WHERE billing_account_id = $1
     RETURNING id`,
    [billingAccountId, status, notes.trim().slice(0, 1000), access.platformAdminId],
  )
  if (!result.rowCount) throw new Error("Cadastro comercial não encontrado na fila de validação.")
  await recordAction(access, `registration.${status}`, "billing_account", billingAccountId, { status, notes: notes.trim().slice(0, 1000) }, ipAddress)
}

export async function setBillingAccountStatus(access: SuperadminAccess, accountId: string, status: "active" | "suspended", ipAddress: string | null) {
  const result = await getPostgresPool().query(
    `UPDATE sf_billing_accounts SET status = $2, updated_at = now() WHERE id = $1 AND status <> 'closed' RETURNING id`,
    [accountId, status],
  )
  if (!result.rowCount) throw new Error("Conta de cobrança não encontrada.")
  await recordAction(access, `billing_account.${status}`, "billing_account", accountId, { status }, ipAddress)
}

export async function changeSubscriptionPlan(access: SuperadminAccess, subscriptionId: string, planId: string, ipAddress: string | null) {
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const plan = await client.query<{ code: string; name: string }>(`SELECT code, name FROM sf_plans WHERE id = $1 AND active = true AND internal = false LIMIT 1`, [planId])
    if (!plan.rows[0]) throw new Error("Plano não encontrado ou inativo.")
    const updated = await client.query<{ billing_account_id: string }>(
      `UPDATE sf_subscriptions SET plan_id = $2, updated_at = now(), metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('superadminPlanChangedAt', now())
       WHERE id = $1 AND status <> 'canceled' RETURNING billing_account_id`,
      [subscriptionId, planId],
    )
    if (!updated.rows[0]) throw new Error("Assinatura não encontrada.")
    await client.query(
      `INSERT INTO sf_subscription_events (id, billing_account_id, subscription_id, event_type, source, payload)
       VALUES ($1, $2, $3, 'subscription.plan_changed_by_superadmin', 'superadmin', $4::jsonb)`,
      [randomUUID(), updated.rows[0].billing_account_id, subscriptionId, JSON.stringify({ planId, planCode: plan.rows[0].code, planName: plan.rows[0].name, actorUserId: access.userId })],
    )
    await client.query(
      `INSERT INTO sf_platform_admin_actions (id, platform_admin_id, action, target_type, target_id, metadata, ip_address)
       VALUES ($1, $2, 'subscription.change_plan', 'subscription', $3, $4::jsonb, $5)`,
      [randomUUID(), access.platformAdminId, subscriptionId, JSON.stringify({ planId, planCode: plan.rows[0].code }), ipAddress],
    )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function setEntitlementOverride(access: SuperadminAccess, accountId: string, key: PlanEntitlementKey, value: unknown, ipAddress: string | null) {
  if (!PLAN_ENTITLEMENT_KEYS.includes(key)) throw new Error("Entitlement inválido.")
  const updated = await getPostgresPool().query(
    `UPDATE sf_billing_accounts
     SET entitlement_overrides = jsonb_set(COALESCE(entitlement_overrides, '{}'::jsonb), ARRAY[$2]::text[], $3::jsonb, true), updated_at = now()
     WHERE id = $1 AND status <> 'closed' RETURNING id`,
    [accountId, key, JSON.stringify(value)],
  )
  if (!updated.rowCount) throw new Error("Conta de cobrança não encontrada.")
  await recordAction(access, "billing_account.entitlement_override", "billing_account", accountId, { key, value }, ipAddress)
}

export async function createCommercialCoupon(access: SuperadminAccess, input: { code: string; description?: string; discountType: "percent" | "fixed"; discountValue: number; validUntil?: string | null }, ipAddress: string | null) {
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "")
  if (code.length < 3 || code.length > 40) throw new Error("Código de cupom inválido.")
  const discountValue = Math.floor(Number(input.discountValue))
  if (!Number.isFinite(discountValue) || discountValue <= 0) throw new Error("Valor de desconto inválido.")
  if (input.discountType === "percent" && discountValue > 100) throw new Error("Percentual inválido.")
  const id = randomUUID()
  await getPostgresPool().query(
    `INSERT INTO sf_commercial_coupons (id, code, description, discount_type, discount_value, valid_until, created_by_platform_admin_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, code, input.description?.trim() || "", input.discountType, discountValue, input.validUntil || null, access.platformAdminId],
  )
  await recordAction(access, "commercial_coupon.create", "commercial_coupon", id, { code, discountType: input.discountType, discountValue }, ipAddress)
}

export async function setSupportCaseStatus(access: SuperadminAccess, caseId: string, status: "open" | "pending" | "resolved" | "closed", ipAddress: string | null) {
  const updated = await getPostgresPool().query(
    `UPDATE sf_support_cases SET status = $2, resolved_at = CASE WHEN $2 IN ('resolved','closed') THEN now() ELSE NULL END, updated_at = now()
     WHERE id = $1 RETURNING id`,
    [caseId, status],
  )
  if (!updated.rowCount) throw new Error("Chamado não encontrado.")
  await recordAction(access, "support_case.status", "support_case", caseId, { status }, ipAddress)
}
