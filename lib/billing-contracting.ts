import { createHash, randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import { hashAdminPassword } from "@/lib/admin-user-db"
import { getBillingSnapshotForUser } from "@/lib/billing-db"
import { getBillingProvider, configuredBillingProviderName } from "@/lib/billing-provider"
import type { ProviderSubscriptionSnapshot } from "@/lib/billing-provider"
import type {
  BillingCycle,
  CommercialBillingStatus,
  CommercialPlan,
  PlanEntitlementKey,
  PlanEntitlements,
  SubscriptionStatus,
} from "@/lib/billing-types"
import { getPostgresPool } from "@/lib/postgres"
import {
  commercialRegistrationMetadata,
  normalizeCommercialRegistration,
  type CommercialRegistrationInput,
} from "@/lib/commercial-registration"

const emptyEntitlements: PlanEntitlements = {
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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function numericLimit(value: unknown): number | null {
  if (value === null || typeof value === "undefined") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.floor(parsed)
}

function mergePlanEntitlements(rows: Array<{ entitlement_key: PlanEntitlementKey; entitlement_value: unknown }>): PlanEntitlements {
  const raw: Record<string, unknown> = {}
  for (const row of rows) raw[row.entitlement_key] = row.entitlement_value
  return {
    maxOrganizations: numericLimit(raw.maxOrganizations),
    maxUsers: numericLimit(raw.maxUsers),
    maxProducts: numericLimit(raw.maxProducts),
    customDomain: raw.customDomain === true,
    delivery: raw.delivery === true,
    kitchen: raw.kitchen === true,
    financial: raw.financial === true,
    loyalty: raw.loyalty === true,
    modifiers: raw.modifiers === true,
    inventory: raw.inventory === true,
    advancedReports: raw.advancedReports === true,
    integrations: raw.integrations === true,
  }
}

export async function listCommercialPlans(): Promise<CommercialPlan[]> {
  const pool = getPostgresPool()
  const plans = await pool.query<{
    id: string
    code: string
    name: string
    description: string
    currency: string
    monthly_price_cents: number | null
    annual_price_cents: number | null
  }>(`
    SELECT id, code, name, description, currency, monthly_price_cents, annual_price_cents
    FROM sf_plans
    WHERE active = true
      AND internal = false
      AND checkout_enabled = true
      AND (
        COALESCE(monthly_price_cents, 0) > 0
        OR COALESCE(annual_price_cents, 0) > 0
      )
    ORDER BY sort_order ASC, name ASC
  `)

  const result: CommercialPlan[] = []
  for (const plan of plans.rows) {
    const entitlements = await pool.query<{
      entitlement_key: PlanEntitlementKey
      entitlement_value: unknown
    }>(`
      SELECT entitlement_key, entitlement_value
      FROM sf_plan_entitlements
      WHERE plan_id = $1
    `, [plan.id])
    result.push({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      currency: plan.currency,
      monthlyPriceCents: plan.monthly_price_cents,
      annualPriceCents: plan.annual_price_cents,
      entitlements: mergePlanEntitlements(entitlements.rows),
    })
  }
  return result
}

export async function registerCommercialUser(input: {
  name: string
  email: string
  password: string
} & CommercialRegistrationInput) {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  if (name.length < 2) throw new Error("Informe seu nome.")
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Informe um e-mail válido.")
  if (input.password.length < 12) throw new Error("A senha deve ter pelo menos 12 caracteres.")

  const registration = normalizeCommercialRegistration(input)
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`saborflow-billing-signup:${email}`])
    const existing = await client.query(`SELECT id FROM sf_users WHERE lower(email) = lower($1) LIMIT 1`, [email])
    if (existing.rowCount) {
      throw new Error("Já existe uma conta com este e-mail. Use a opção de entrar para continuar a contratação.")
    }

    const documentOwner = await client.query(
      `SELECT id FROM sf_users WHERE cpf = $1 OR cpf = $2 LIMIT 1`,
      [registration.cpfHash, registration.cpfDigits],
    )
    if (documentOwner.rowCount) {
      throw new Error("Este CPF já está vinculado a uma conta SaborFlow.")
    }

    const userId = randomUUID()
    const billingAccountId = randomUUID()
    await client.query(`
      INSERT INTO sf_users (id, name, email, cpf, password_hash, password_updated_at, status)
      VALUES ($1, $2, $3, $4, $5, now(), 'active')
    `, [userId, name, email, registration.cpfHash, hashAdminPassword(input.password)])
    await client.query(`
      INSERT INTO sf_billing_accounts (
        id, owner_user_id, billing_email, status, entitlement_overrides, metadata
      ) VALUES ($1, $2, $3, 'active', '{}'::jsonb, $4::jsonb)
    `, [
      billingAccountId,
      userId,
      email,
      JSON.stringify(commercialRegistrationMetadata(registration, "public-contracting-password")),
    ])
    await client.query("COMMIT")
    return { userId, billingAccountId, email }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function registerCommercialGoogleUser(input: {
  name: string
  email: string
  googleSubject: string
} & CommercialRegistrationInput) {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const googleSubject = input.googleSubject.trim()
  if (name.length < 2 || !googleSubject) throw new Error("Conta Google inválida.")
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Conta Google sem e-mail válido.")

  const registration = normalizeCommercialRegistration(input)
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`saborflow-google-signup:${googleSubject}`])

    const googleExisting = await client.query<{ id: string; email: string | null }>(
      `SELECT id, email FROM sf_users WHERE google_subject = $1 LIMIT 1`,
      [googleSubject],
    )
    if (googleExisting.rowCount) {
      throw new Error("Esta Conta Google já está vinculada ao SaborFlow. Use a opção de entrar.")
    }

    const emailExisting = await client.query<{ google_subject: string | null }>(
      `SELECT google_subject FROM sf_users WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    )
    if (emailExisting.rowCount) {
      throw new Error("Já existe uma conta SaborFlow com este e-mail. Entre com sua senha; a vinculação do Google será feita pela área de segurança.")
    }

    const documentOwner = await client.query(
      `SELECT id FROM sf_users WHERE cpf = $1 OR cpf = $2 LIMIT 1`,
      [registration.cpfHash, registration.cpfDigits],
    )
    if (documentOwner.rowCount) {
      throw new Error("Este CPF já está vinculado a uma conta SaborFlow.")
    }

    const userId = randomUUID()
    const billingAccountId = randomUUID()
    await client.query(`
      INSERT INTO sf_users (id, name, email, cpf, google_subject, password_hash, status, last_login_at)
      VALUES ($1, $2, $3, $4, $5, NULL, 'active', now())
    `, [userId, name, email, registration.cpfHash, googleSubject])
    await client.query(`
      INSERT INTO sf_billing_accounts (
        id, owner_user_id, billing_email, status, entitlement_overrides, metadata
      ) VALUES ($1, $2, $3, 'active', '{}'::jsonb, $4::jsonb)
    `, [
      billingAccountId,
      userId,
      email,
      JSON.stringify(commercialRegistrationMetadata(registration, "public-contracting-google")),
    ])
    await client.query("COMMIT")
    return { userId, billingAccountId, email }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function authenticateCommercialGoogleUser(input: {
  googleSubject: string
  email: string
}) {
  const result = await getPostgresPool().query<{
    id: string
    email: string
    status: string
  }>(
    `
      SELECT id, email, status
      FROM sf_users
      WHERE google_subject = $1
      LIMIT 1
    `,
    [input.googleSubject.trim()],
  )
  const user = result.rows[0]
  if (!user || user.status !== "active") return null
  if (normalizeEmail(user.email) !== normalizeEmail(input.email)) return null

  await getPostgresPool().query(
    `UPDATE sf_users SET last_login_at = now(), updated_at = now() WHERE id = $1`,
    [user.id],
  )

  const account = await getBillingAccountForUser(user.id)
  if (!account) return null
  return {
    userId: user.id,
    billingAccountId: account.id,
    email: user.email,
  }
}

export async function getBillingAccountForUser(userId: string) {
  const result = await getPostgresPool().query<{
    id: string
    billing_email: string | null
    onboarding_unlocked_at: Date | string | null
  }>(`
    SELECT id, billing_email, onboarding_unlocked_at
    FROM sf_billing_accounts
    WHERE owner_user_id = $1
    LIMIT 1
  `, [userId])
  return result.rows[0] || null
}

async function publicPlanForCheckout(client: PoolClient, code: string, cycle: BillingCycle) {
  const result = await client.query<{
    id: string
    code: string
    name: string
    currency: string
    monthly_price_cents: number | null
    annual_price_cents: number | null
  }>(`
    SELECT id, code, name, currency, monthly_price_cents, annual_price_cents
    FROM sf_plans
    WHERE lower(code) = lower($1)
      AND active = true
      AND internal = false
      AND checkout_enabled = true
    LIMIT 1
  `, [code])
  const plan = result.rows[0]
  if (!plan) throw new Error("Plano comercial indisponível.")
  const amountCents = cycle === "annual" ? plan.annual_price_cents : plan.monthly_price_cents
  if (!amountCents || amountCents <= 0) throw new Error("Este ciclo de cobrança não está disponível para o plano selecionado.")
  return { ...plan, amountCents }
}

export async function createCheckoutForUser(input: {
  userId: string
  email: string
  planCode: string
  billingCycle: BillingCycle
  returnUrl: string
}) {
  const providerName = configuredBillingProviderName()
  const provider = getBillingProvider(providerName)
  if (!provider.configured()) throw new Error("O provedor de cobrança ainda não foi configurado.")

  const client = await getPostgresPool().connect()
  let checkoutSessionId = ""
  let localSubscriptionId = ""
  let billingAccountId = ""
  let plan: Awaited<ReturnType<typeof publicPlanForCheckout>>
  try {
    await client.query("BEGIN")
    const account = await client.query<{ id: string; billing_email: string | null; status: string }>(`
      SELECT id, billing_email, status
      FROM sf_billing_accounts
      WHERE owner_user_id = $1
      LIMIT 1
      FOR UPDATE
    `, [input.userId])
    const row = account.rows[0]
    if (!row) throw new Error("Conta comercial não encontrada.")
    if (row.status !== "active") throw new Error("A conta comercial está suspensa.")
    billingAccountId = row.id
    plan = await publicPlanForCheckout(client, input.planCode, input.billingCycle)

    const reusable = await client.query<{
      id: string
      subscription_id: string
      status: string
      checkout_url: string | null
    }>(`
      SELECT cs.id, cs.subscription_id, cs.status, cs.checkout_url
      FROM sf_checkout_sessions cs
      WHERE cs.billing_account_id = $1
        AND cs.plan_id = $2
        AND cs.billing_cycle = $3
        AND cs.provider = $4
        AND cs.status IN ('creating', 'pending')
        AND cs.created_at > now() - interval '30 minutes'
      ORDER BY cs.created_at DESC
      LIMIT 1
    `, [billingAccountId, plan.id, input.billingCycle, provider.name])

    if (reusable.rows[0]?.checkout_url) {
      await client.query("COMMIT")
      return { checkoutUrl: reusable.rows[0].checkout_url, reused: true }
    }
    if (reusable.rows[0]?.status === "creating") {
      throw new Error("Já existe um checkout sendo preparado. Aguarde alguns segundos e tente novamente.")
    }

    checkoutSessionId = randomUUID()
    localSubscriptionId = randomUUID()
    await client.query(`
      INSERT INTO sf_subscriptions (
        id, billing_account_id, plan_id, status, billing_cycle, provider, provider_status, metadata
      ) VALUES ($1, $2, $3, 'pending', $4, $5, 'creating', $6::jsonb)
    `, [
      localSubscriptionId,
      billingAccountId,
      plan.id,
      input.billingCycle,
      provider.name,
      JSON.stringify({ source: "phase-14-checkout" }),
    ])
    await client.query(`
      INSERT INTO sf_checkout_sessions (
        id, billing_account_id, user_id, plan_id, subscription_id,
        billing_cycle, provider, status, amount_cents, currency, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'creating', $8, $9, now() + interval '30 minutes')
    `, [
      checkoutSessionId,
      billingAccountId,
      input.userId,
      plan.id,
      localSubscriptionId,
      input.billingCycle,
      provider.name,
      plan.amountCents,
      plan.currency,
    ])
    await client.query(`
      UPDATE sf_subscriptions
      SET source_checkout_session_id = $2, updated_at = now()
      WHERE id = $1
    `, [localSubscriptionId, checkoutSessionId])
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  try {
    const checkout = await provider.createCheckout({
      checkoutSessionId,
      localSubscriptionId,
      planCode: plan!.code,
      planName: plan!.name,
      billingCycle: input.billingCycle,
      amountCents: plan!.amountCents,
      currency: plan!.currency,
      payerEmail: normalizeEmail(input.email),
      returnUrl: input.returnUrl,
    })
    await getPostgresPool().query(`
      UPDATE sf_checkout_sessions
      SET status = 'pending', provider_checkout_id = $2, provider_subscription_id = $3,
          checkout_url = $4, metadata = metadata || $5::jsonb, updated_at = now()
      WHERE id = $1
    `, [checkoutSessionId, checkout.providerCheckoutId, checkout.providerSubscriptionId, checkout.checkoutUrl, JSON.stringify({ providerStatus: checkout.providerStatus })])
    await getPostgresPool().query(`
      UPDATE sf_subscriptions
      SET provider_subscription_id = $2, provider_status = $3,
          metadata = metadata || $4::jsonb, last_provider_sync_at = now(), updated_at = now()
      WHERE id = $1
    `, [localSubscriptionId, checkout.providerSubscriptionId, checkout.providerStatus, JSON.stringify({ checkoutCreated: true })])
    return { checkoutUrl: checkout.checkoutUrl, reused: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar checkout."
    await getPostgresPool().query(`
      UPDATE sf_checkout_sessions
      SET status = 'failed', error_message = $2, updated_at = now()
      WHERE id = $1
    `, [checkoutSessionId, message]).catch(() => undefined)
    await getPostgresPool().query(`
      UPDATE sf_subscriptions
      SET provider_status = 'checkout_failed', updated_at = now()
      WHERE id = $1
    `, [localSubscriptionId]).catch(() => undefined)
    throw error
  }
}

function mapProviderStatus(provider: string, status: string): SubscriptionStatus {
  const normalized = status.toLowerCase()
  if (provider === "mercado_pago") {
    if (normalized === "authorized") return "active"
    if (normalized === "paused") return "suspended"
    if (normalized === "cancelled" || normalized === "canceled") return "canceled"
    return "pending"
  }
  return "pending"
}

export async function applyProviderSubscriptionSnapshot(
  localSubscriptionId: string,
  snapshot: ProviderSubscriptionSnapshot,
  source: string,
  providerEventId?: string | null,
) {
  const mapped = mapProviderStatus(snapshot.provider, snapshot.status)
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const current = await client.query<{
      id: string
      billing_account_id: string
      status: SubscriptionStatus
      source_checkout_session_id: string | null
      metadata: Record<string, unknown> | null
    }>(`
      SELECT id, billing_account_id, status, source_checkout_session_id, metadata
      FROM sf_subscriptions
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `, [localSubscriptionId])
    const subscription = current.rows[0]
    if (!subscription) {
      await client.query("ROLLBACK")
      return false
    }

    const supersededBy = subscription.metadata && typeof subscription.metadata === "object"
      ? String(subscription.metadata.supersededBy || "")
      : ""

    // Um webhook atrasado de um checkout antigo nunca pode reativar um plano que já
    // foi substituído por uma assinatura mais nova.
    if (mapped === "active" && supersededBy) {
      await client.query(`
        UPDATE sf_subscriptions
        SET provider_status = $2,
            provider_subscription_id = COALESCE(provider_subscription_id, $3),
            last_provider_sync_at = now(), updated_at = now()
        WHERE id = $1
      `, [subscription.id, snapshot.status, snapshot.id])
      await client.query(`
        INSERT INTO sf_subscription_events (
          id, billing_account_id, subscription_id, event_type, source, provider_event_id, payload
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (source, provider_event_id) WHERE provider_event_id IS NOT NULL DO NOTHING
      `, [
        randomUUID(),
        subscription.billing_account_id,
        subscription.id,
        `provider_status_ignored:${snapshot.status}`,
        source,
        providerEventId || null,
        JSON.stringify({ mappedStatus: mapped, providerSubscriptionId: snapshot.id, supersededBy }),
      ])
      await client.query("COMMIT")
      return true
    }

    if (mapped === "active") {
      await client.query(`
        UPDATE sf_subscriptions
        SET status = 'canceled',
            canceled_at = COALESCE(canceled_at, now()),
            metadata = metadata || jsonb_build_object(
              'supersededBy', $2::text,
              'supersededAt', now()
            ),
            updated_at = now()
        WHERE billing_account_id = $1
          AND id <> $2
          AND status IN ('pending', 'trialing', 'active', 'past_due', 'suspended')
      `, [subscription.billing_account_id, subscription.id])

      await client.query(`
        UPDATE sf_checkout_sessions
        SET status = 'canceled', updated_at = now()
        WHERE billing_account_id = $1
          AND subscription_id <> $2
          AND status IN ('creating', 'pending')
      `, [subscription.billing_account_id, subscription.id])
    }

    await client.query(`
      UPDATE sf_subscriptions
      SET status = $2,
          provider_status = $3,
          provider_subscription_id = COALESCE(provider_subscription_id, $4),
          activated_at = CASE WHEN $2 = 'active' THEN COALESCE(activated_at, now()) ELSE activated_at END,
          canceled_at = CASE WHEN $2 = 'canceled' THEN COALESCE(canceled_at, now()) ELSE canceled_at END,
          current_period_start = CASE WHEN $2 = 'active' THEN COALESCE(current_period_start, now()) ELSE current_period_start END,
          current_period_end = CASE
            WHEN $5::text IS NOT NULL THEN $5::timestamptz
            ELSE current_period_end
          END,
          last_provider_sync_at = now(),
          updated_at = now()
      WHERE id = $1
    `, [subscription.id, mapped, snapshot.status, snapshot.id, snapshot.nextPaymentDate])

    if (subscription.source_checkout_session_id) {
      await client.query(`
        UPDATE sf_checkout_sessions
        SET status = CASE
              WHEN $2 = 'active' THEN 'completed'
              WHEN $2 = 'canceled' THEN 'canceled'
              ELSE status
            END,
            completed_at = CASE WHEN $2 = 'active' THEN COALESCE(completed_at, now()) ELSE completed_at END,
            provider_subscription_id = COALESCE(provider_subscription_id, $3),
            updated_at = now()
        WHERE id = $1
      `, [subscription.source_checkout_session_id, mapped, snapshot.id])
    }

    if (mapped === "active") {
      await client.query(`
        UPDATE sf_billing_accounts
        SET onboarding_unlocked_at = COALESCE(onboarding_unlocked_at, now()),
            entitlement_overrides = CASE
              WHEN metadata->>'bootstrap' IN ('phase-13', 'phase-13-created-by')
                THEN entitlement_overrides - 'maxOrganizations'
              ELSE entitlement_overrides
            END,
            updated_at = now()
        WHERE id = $1
      `, [subscription.billing_account_id])
    }

    await client.query(`
      INSERT INTO sf_subscription_events (
        id, billing_account_id, subscription_id, event_type, source, provider_event_id, payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (source, provider_event_id) WHERE provider_event_id IS NOT NULL DO NOTHING
    `, [
      randomUUID(),
      subscription.billing_account_id,
      subscription.id,
      `provider_status:${snapshot.status}`,
      source,
      providerEventId || null,
      JSON.stringify({ mappedStatus: mapped, providerSubscriptionId: snapshot.id }),
    ])

    await client.query("COMMIT")
    return true
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function reconcileLatestSubscriptionForUser(userId: string) {
  const latest = await getPostgresPool().query<{
    id: string
    provider: string | null
    provider_subscription_id: string | null
    status: SubscriptionStatus
  }>(`
    SELECT s.id, s.provider, s.provider_subscription_id, s.status
    FROM sf_subscriptions s
    INNER JOIN sf_billing_accounts ba ON ba.id = s.billing_account_id
    WHERE ba.owner_user_id = $1
      AND s.provider IS NOT NULL
      AND s.provider_subscription_id IS NOT NULL
      AND s.status IN ('pending', 'past_due', 'suspended')
    ORDER BY s.created_at DESC
    LIMIT 1
  `, [userId])
  const row = latest.rows[0]
  if (!row?.provider || !row.provider_subscription_id) return false
  const provider = getBillingProvider(row.provider)
  if (!provider.configured()) return false
  const snapshot = await provider.getSubscription(row.provider_subscription_id)
  return applyProviderSubscriptionSnapshot(row.id, snapshot, `${row.provider}:reconcile`, null)
}

export async function getCommercialBillingStatus(userId: string, email: string): Promise<CommercialBillingStatus> {
  const [account, billing, orgs, checkout] = await Promise.all([
    getBillingAccountForUser(userId),
    getBillingSnapshotForUser(userId),
    getPostgresPool().query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM sf_memberships
      WHERE user_id = $1 AND status = 'active'
    `, [userId]),
    getPostgresPool().query<{
      id: string
      status: "creating" | "pending" | "completed" | "failed" | "canceled" | "expired"
      checkout_url: string | null
      plan_code: string
      plan_name: string
      billing_cycle: BillingCycle
      subscription_status: SubscriptionStatus
    }>(`
      SELECT
        cs.id, cs.status, cs.checkout_url, p.code AS plan_code, p.name AS plan_name,
        cs.billing_cycle, s.status AS subscription_status
      FROM sf_checkout_sessions cs
      INNER JOIN sf_billing_accounts ba ON ba.id = cs.billing_account_id
      INNER JOIN sf_plans p ON p.id = cs.plan_id
      INNER JOIN sf_subscriptions s ON s.id = cs.subscription_id
      WHERE ba.owner_user_id = $1
      ORDER BY cs.created_at DESC
      LIMIT 1
    `, [userId]),
  ])
  const c = checkout.rows[0]
  return {
    authenticated: true,
    email,
    hasOrganization: Number(orgs.rows[0]?.count || 0) > 0,
    onboardingUnlocked: Boolean(account?.onboarding_unlocked_at && billing.subscription?.status === "active"),
    billing,
    latestCheckout: c ? {
      id: c.id,
      status: c.status,
      checkoutUrl: c.checkout_url,
      planCode: c.plan_code,
      planName: c.plan_name,
      billingCycle: c.billing_cycle,
      subscriptionStatus: c.subscription_status,
    } : null,
  }
}

export async function processBillingWebhook(input: {
  provider: string
  providerEventId: string
  eventType: string | null
  resourceId: string | null
  payload: unknown
}) {
  const pool = getPostgresPool()
  const inserted = await pool.query<{ id: string }>(`
    INSERT INTO sf_billing_webhook_events (
      id, provider, provider_event_id, event_type, resource_id, signature_valid, processing_status, payload, attempts
    ) VALUES ($1, $2, $3, $4, $5, true, 'received', $6::jsonb, 1)
    ON CONFLICT (provider, provider_event_id) DO NOTHING
    RETURNING id
  `, [randomUUID(), input.provider, input.providerEventId, input.eventType, input.resourceId, JSON.stringify(input.payload ?? {})])

  let rowId = inserted.rows[0]?.id || ""
  if (!inserted.rowCount) {
    const existing = await pool.query<{ id: string; processing_status: string }>(`
      SELECT id, processing_status
      FROM sf_billing_webhook_events
      WHERE provider = $1 AND provider_event_id = $2
      LIMIT 1
    `, [input.provider, input.providerEventId])
    const previous = existing.rows[0]
    if (!previous) return { duplicate: true, processed: false }

    const retry = await pool.query<{ id: string }>(`
      UPDATE sf_billing_webhook_events
      SET processing_status = 'received', error_message = NULL,
          attempts = attempts + 1, updated_at = now()
      WHERE id = $1
        AND (
          processing_status = 'failed'
          OR (processing_status = 'received' AND updated_at < now() - interval '5 minutes')
        )
      RETURNING id
    `, [previous.id])
    if (!retry.rowCount) {
      return {
        duplicate: true,
        processed: previous.processing_status === 'processed' || previous.processing_status === 'ignored',
      }
    }
    rowId = retry.rows[0].id
  }

  try {
    if (!input.resourceId || input.eventType !== "subscription_preapproval") {
      await pool.query(`
        UPDATE sf_billing_webhook_events
        SET processing_status = 'ignored', processed_at = now(), updated_at = now()
        WHERE id = $1
      `, [rowId])
      return { duplicate: false, processed: false }
    }

    const provider = getBillingProvider(input.provider)
    const snapshot = await provider.getSubscription(input.resourceId)
    let local = await pool.query<{ id: string }>(`
      SELECT id FROM sf_subscriptions
      WHERE provider = $1 AND provider_subscription_id = $2
      ORDER BY created_at DESC LIMIT 1
    `, [input.provider, snapshot.id])
    if (!local.rowCount && snapshot.externalReference) {
      local = await pool.query<{ id: string }>(`
        SELECT id FROM sf_subscriptions
        WHERE id::text = $1
        LIMIT 1
      `, [snapshot.externalReference])
    }
    if (!local.rowCount) {
      await pool.query(`
        UPDATE sf_billing_webhook_events
        SET processing_status = 'ignored', processed_at = now(), updated_at = now()
        WHERE id = $1
      `, [rowId])
      return { duplicate: false, processed: false }
    }

    await applyProviderSubscriptionSnapshot(local.rows[0].id, snapshot, input.provider, input.providerEventId)
    await pool.query(`
      UPDATE sf_billing_webhook_events
      SET processing_status = 'processed', processed_at = now(), updated_at = now()
      WHERE id = $1
    `, [rowId])
    return { duplicate: false, processed: true }
  } catch (error) {
    await pool.query(`
      UPDATE sf_billing_webhook_events
      SET processing_status = 'failed', error_message = $2, updated_at = now()
      WHERE id = $1
    `, [rowId, error instanceof Error ? error.message : "Falha ao processar webhook."]).catch(() => undefined)
    throw error
  }
}

export function deterministicWebhookEventId(rawBody: string, eventId?: unknown) {
  if (typeof eventId === "string" || typeof eventId === "number") return String(eventId)
  return createHash("sha256").update(rawBody).digest("hex")
}

export { emptyEntitlements }
