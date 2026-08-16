import { getBillingSnapshotForOrganization } from "@/lib/billing-db"
import { getTenantCustomers } from "@/lib/customer-db"
import { getTenantSettings } from "@/lib/organization-db"
import { getPostgresPool } from "@/lib/postgres"
import type { TenantAdminSession } from "@/lib/tenant-access"
import { permissionListHas } from "@/lib/operational-permissions"

export type CrmAudienceSegment =
  | "all"
  | "new"
  | "repeat"
  | "frequent"
  | "elite"
  | "active"
  | "sleeping"
  | "inactive"
  | "never"

export type CrmCampaignChannel = "manual" | "whatsapp" | "email" | "sms"
export type CrmCampaignStatus = "draft" | "ready" | "archived"

export type CrmCustomer = {
  key: string
  accountId: number | null
  name: string
  phone: string
  email: string
  orders: number
  totalSpent: number
  lastOrderAt: string
  loyaltyPoints: number
  segment: "new" | "repeat" | "frequent" | "elite"
  lifecycle: "never" | "active" | "sleeping" | "inactive"
  tags: string[]
  notes: string
  marketingOptIn: boolean
  consentSource: string | null
  consentAt: string | null
  lastContactAt: string | null
}

export type CrmCampaign = {
  id: string
  name: string
  channel: CrmCampaignChannel
  status: CrmCampaignStatus
  audienceSegment: CrmAudienceSegment
  message: string
  couponCode: string
  scheduledFor: string | null
  audienceCount: number
  createdAt: string
  updatedAt: string
}

export type LoyaltyLedgerItem = {
  id: string
  customerId: number
  customerName: string
  orderId: number | null
  kind: "opening" | "earn" | "redeem" | "adjust" | "reversal"
  points: number
  balanceAfter: number
  reason: string
  createdAt: string
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function normalizePhone(value: string) {
  return String(value || "").replace(/\D/g, "")
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))]
    .slice(0, 12)
    .map((item) => item.slice(0, 40))
}

export function canAccessCrm(session: TenantAdminSession) {
  return permissionListHas(session.operationalPermissions, "crm.manage")
}

async function billingState(session: TenantAdminSession) {
  const billing = await getBillingSnapshotForOrganization(session.organizationId)
  const subscriptionActive =
    billing.account?.status === "active" &&
    ["active", "trialing"].includes(billing.subscription?.status || "")
  return {
    billing,
    subscriptionActive,
    entitlementEnabled: Boolean(billing.entitlements.loyalty),
  }
}

async function assertCrmAvailable(session: TenantAdminSession) {
  if (!canAccessCrm(session)) {
    throw new Error("Seu perfil não possui acesso ao CRM e fidelidade.")
  }
  const state = await billingState(session)
  if (!state.subscriptionActive) {
    throw new Error("A assinatura precisa estar ativa para usar CRM e fidelidade.")
  }
  if (!state.entitlementEnabled) {
    throw new Error("CRM e fidelidade não estão incluídos no plano atual.")
  }
  return state
}

type AccountRow = {
  id: number
  phone_normalized: string
  phone: string
  email: string
  loyalty_points: number
  active: boolean
}

type ProfileRow = {
  customer_key: string
  customer_id: number | null
  tags: string[]
  notes: string
  marketing_opt_in: boolean
  consent_source: string | null
  consent_at: Date | string | null
  last_contact_at: Date | string | null
}

type CampaignRow = {
  id: string
  name: string
  channel: CrmCampaignChannel
  status: CrmCampaignStatus
  audience_segment: CrmAudienceSegment
  message: string
  coupon_code: string | null
  scheduled_for: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

function matchesAudience(customer: CrmCustomer, segment: CrmAudienceSegment) {
  if (segment === "all") return true
  return customer.segment === segment || customer.lifecycle === segment
}

export async function getCrmOverview(session: TenantAdminSession) {
  const state = await assertCrmAvailable(session)
  const [summaries, accountsResult, profilesResult, campaignsResult, ledgerResult, settings] =
    await Promise.all([
      getTenantCustomers(session.organizationId),
      getPostgresPool().query<AccountRow>(
        `
          SELECT id, phone_normalized, phone, email, loyalty_points, active
          FROM sf_customer_accounts
          WHERE organization_id = $1
          ORDER BY updated_at DESC, id DESC
        `,
        [session.organizationId],
      ),
      getPostgresPool().query<ProfileRow>(
        `
          SELECT customer_key, customer_id, tags, notes, marketing_opt_in,
                 consent_source, consent_at, last_contact_at
          FROM sf_crm_customer_profiles
          WHERE organization_id = $1
        `,
        [session.organizationId],
      ),
      getPostgresPool().query<CampaignRow>(
        `
          SELECT id, name, channel, status, audience_segment, message,
                 coupon_code, scheduled_for, created_at, updated_at
          FROM sf_crm_campaigns
          WHERE organization_id = $1
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 100
        `,
        [session.organizationId],
      ),
      getPostgresPool().query<{
        id: string
        customer_id: number
        customer_name: string
        order_id: number | null
        kind: LoyaltyLedgerItem["kind"]
        points: number
        balance_after: number
        reason: string
        created_at: Date | string
      }>(
        `
          SELECT l.id, l.customer_id, a.name AS customer_name, l.order_id,
                 l.kind, l.points, l.balance_after, l.reason, l.created_at
          FROM sf_loyalty_ledger l
          INNER JOIN sf_customer_accounts a
            ON a.organization_id = l.organization_id
           AND a.id = l.customer_id
          WHERE l.organization_id = $1
          ORDER BY l.created_at DESC
          LIMIT 100
        `,
        [session.organizationId],
      ),
      getTenantSettings(session.organizationId),
    ])

  const accountByPhone = new Map<string, AccountRow>()
  const accountById = new Map<number, AccountRow>()
  for (const row of accountsResult.rows) {
    accountById.set(Number(row.id), row)
    if (row.phone_normalized) accountByPhone.set(row.phone_normalized, row)
  }

  const profileByKey = new Map(profilesResult.rows.map((row) => [row.customer_key, row]))

  const customers: CrmCustomer[] = summaries.map((summary) => {
    const byKeyId = summary.key.startsWith("account-")
      ? accountById.get(Number(summary.key.slice("account-".length)))
      : undefined
    const account = byKeyId || accountByPhone.get(normalizePhone(summary.phone)) || null
    const profile = profileByKey.get(summary.key)
    return {
      key: summary.key,
      accountId: account ? Number(account.id) : profile?.customer_id ? Number(profile.customer_id) : null,
      name: summary.name,
      phone: summary.phone,
      email: account?.email || "",
      orders: Number(summary.orders || 0),
      totalSpent: Number(summary.totalSpent || 0),
      lastOrderAt: summary.lastOrderAt,
      loyaltyPoints: account ? Number(account.loyalty_points || 0) : Number(summary.loyaltyPoints || 0),
      segment: summary.segment,
      lifecycle: summary.lifecycle,
      tags: cleanTags(profile?.tags),
      notes: profile?.notes || "",
      marketingOptIn: Boolean(profile?.marketing_opt_in),
      consentSource: profile?.consent_source || null,
      consentAt: iso(profile?.consent_at),
      lastContactAt: iso(profile?.last_contact_at),
    }
  })

  const optInCustomers = customers.filter((customer) => customer.marketingOptIn)
  const campaigns: CrmCampaign[] = campaignsResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    channel: row.channel,
    status: row.status,
    audienceSegment: row.audience_segment,
    message: row.message,
    couponCode: row.coupon_code || "",
    scheduledFor: iso(row.scheduled_for),
    audienceCount: optInCustomers.filter((customer) => matchesAudience(customer, row.audience_segment)).length,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  }))

  const rewardPoints = Math.max(1, Number(settings?.loyaltyRewardPoints || 100))
  const ledger: LoyaltyLedgerItem[] = ledgerResult.rows.map((row) => ({
    id: row.id,
    customerId: Number(row.customer_id),
    customerName: row.customer_name,
    orderId: row.order_id === null ? null : Number(row.order_id),
    kind: row.kind,
    points: Number(row.points),
    balanceAfter: Number(row.balance_after),
    reason: row.reason || "",
    createdAt: iso(row.created_at)!,
  }))

  return {
    organization: {
      id: session.organizationId,
      name: session.organizationName,
    },
    billing: {
      planCode: state.billing.subscription?.planCode || null,
      subscriptionActive: state.subscriptionActive,
      loyaltyIncluded: state.entitlementEnabled,
    },
    loyalty: {
      enabled: Boolean(settings?.loyaltyEnabled),
      pointsPerReal: Number(settings?.loyaltyPointsPerReal || 0),
      rewardPoints,
      rewardText: settings?.loyaltyRewardText || "",
      outstandingPoints: customers.reduce((sum, item) => sum + Math.max(0, item.loyaltyPoints), 0),
      rewardEligibleCustomers: customers.filter((item) => item.accountId && item.loyaltyPoints >= rewardPoints).length,
    },
    stats: {
      customers: customers.length,
      registeredAccounts: accountsResult.rows.filter((row) => row.active).length,
      marketingOptIn: optInCustomers.length,
      activeCustomers: customers.filter((item) => item.lifecycle === "active").length,
      sleepingCustomers: customers.filter((item) => item.lifecycle === "sleeping").length,
      inactiveCustomers: customers.filter((item) => item.lifecycle === "inactive").length,
      campaignsDraft: campaigns.filter((item) => item.status === "draft").length,
      campaignsReady: campaigns.filter((item) => item.status === "ready").length,
    },
    customers,
    campaigns,
    ledger,
  }
}

async function audit(
  session: TenantAdminSession,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown>,
) {
  await getPostgresPool().query(
    `
      INSERT INTO sf_audit_log (
        id, organization_id, user_id, action, entity_type, entity_id, metadata, created_at
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb, now())
    `,
    [session.organizationId, session.userId, action, entityType, entityId, JSON.stringify(metadata)],
  )
}

export async function updateCrmCustomerProfile(
  session: TenantAdminSession,
  input: {
    customerKey: string
    accountId?: number | null
    tags?: unknown
    notes?: string
    marketingOptIn?: boolean
    markContacted?: boolean
  },
) {
  await assertCrmAvailable(session)
  const customerKey = String(input.customerKey || "").trim().slice(0, 200)
  if (!customerKey) throw new Error("Cliente inválido.")

  const accountId = Number(input.accountId || 0)
  const normalizedAccountId = Number.isInteger(accountId) && accountId > 0 ? accountId : null
  if (normalizedAccountId) {
    const account = await getPostgresPool().query(
      `SELECT 1 FROM sf_customer_accounts WHERE organization_id = $1 AND id = $2 LIMIT 1`,
      [session.organizationId, normalizedAccountId],
    )
    if (!account.rowCount) throw new Error("Conta de cliente inválida para esta empresa.")
  }

  const tags = cleanTags(input.tags)
  const notes = String(input.notes || "").trim().slice(0, 2000)
  const marketingOptIn = Boolean(input.marketingOptIn)

  await getPostgresPool().query(
    `
      INSERT INTO sf_crm_customer_profiles (
        organization_id, customer_key, customer_id, tags, notes,
        marketing_opt_in, consent_source, consent_at, last_contact_at,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4::text[], $5, $6,
        CASE WHEN $6 THEN $7 ELSE NULL END,
        CASE WHEN $6 THEN now() ELSE NULL END,
        CASE WHEN $8 THEN now() ELSE NULL END,
        now(), now()
      )
      ON CONFLICT (organization_id, customer_key)
      DO UPDATE SET
        customer_id = COALESCE(EXCLUDED.customer_id, sf_crm_customer_profiles.customer_id),
        tags = EXCLUDED.tags,
        notes = EXCLUDED.notes,
        marketing_opt_in = EXCLUDED.marketing_opt_in,
        consent_source = CASE
          WHEN EXCLUDED.marketing_opt_in AND NOT sf_crm_customer_profiles.marketing_opt_in
            THEN EXCLUDED.consent_source
          WHEN NOT EXCLUDED.marketing_opt_in THEN NULL
          ELSE sf_crm_customer_profiles.consent_source
        END,
        consent_at = CASE
          WHEN EXCLUDED.marketing_opt_in AND NOT sf_crm_customer_profiles.marketing_opt_in
            THEN now()
          WHEN NOT EXCLUDED.marketing_opt_in THEN NULL
          ELSE sf_crm_customer_profiles.consent_at
        END,
        last_contact_at = CASE
          WHEN $8 THEN now()
          ELSE sf_crm_customer_profiles.last_contact_at
        END,
        updated_at = now()
    `,
    [
      session.organizationId,
      customerKey,
      normalizedAccountId,
      tags,
      notes,
      marketingOptIn,
      `admin:${session.userId}`,
      Boolean(input.markContacted),
    ],
  )

  await audit(session, "crm.customer_profile.updated", "crm_customer", customerKey, {
    accountId: normalizedAccountId,
    tags,
    marketingOptIn,
    markContacted: Boolean(input.markContacted),
  })
}

export async function adjustCustomerLoyalty(
  session: TenantAdminSession,
  input: { accountId: number; points: number; reason: string },
) {
  await assertCrmAvailable(session)
  const accountId = Number(input.accountId)
  const points = Math.trunc(Number(input.points))
  const reason = String(input.reason || "").trim().slice(0, 250)
  if (!Number.isInteger(accountId) || accountId <= 0) throw new Error("Conta de cliente inválida.")
  if (!points || Math.abs(points) > 100_000) throw new Error("Ajuste de pontos inválido.")
  if (reason.length < 3) throw new Error("Informe o motivo do ajuste de pontos.")

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const current = await client.query<{ loyalty_points: number }>(
      `SELECT loyalty_points FROM sf_customer_accounts WHERE organization_id = $1 AND id = $2 AND active = true FOR UPDATE`,
      [session.organizationId, accountId],
    )
    if (!current.rows[0]) throw new Error("Conta de cliente não encontrada.")
    const balance = Number(current.rows[0].loyalty_points || 0)
    if (balance + points < 0) throw new Error("O cliente não possui pontos suficientes para este ajuste.")

    const updated = await client.query<{ loyalty_points: number }>(
      `UPDATE sf_customer_accounts SET loyalty_points = loyalty_points + $3, updated_at = now() WHERE organization_id = $1 AND id = $2 RETURNING loyalty_points`,
      [session.organizationId, accountId, points],
    )
    const nextBalance = Number(updated.rows[0]?.loyalty_points || 0)
    await client.query(
      `
        INSERT INTO sf_loyalty_ledger (
          organization_id, customer_id, kind, points, balance_after,
          reason, created_by_user_id, created_at
        )
        VALUES ($1, $2, 'adjust', $3, $4, $5, $6, now())
      `,
      [session.organizationId, accountId, points, nextBalance, reason, session.userId],
    )
    await client.query("COMMIT")
    await audit(session, "loyalty.adjusted", "customer_account", String(accountId), {
      points,
      balanceAfter: nextBalance,
      reason,
    })
    return nextBalance
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function redeemCustomerLoyalty(
  session: TenantAdminSession,
  input: { accountId: number },
) {
  await assertCrmAvailable(session)
  const settings = await getTenantSettings(session.organizationId)
  if (!settings?.loyaltyEnabled) throw new Error("O programa de fidelidade está desativado.")
  const cost = Math.max(1, Math.trunc(Number(settings.loyaltyRewardPoints || 0)))
  const reason = (settings.loyaltyRewardText || "Resgate do benefício de fidelidade").slice(0, 250)
  const accountId = Number(input.accountId)
  if (!Number.isInteger(accountId) || accountId <= 0) throw new Error("Conta de cliente inválida.")

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const current = await client.query<{ loyalty_points: number }>(
      `SELECT loyalty_points FROM sf_customer_accounts WHERE organization_id = $1 AND id = $2 AND active = true FOR UPDATE`,
      [session.organizationId, accountId],
    )
    if (!current.rows[0]) throw new Error("Conta de cliente não encontrada.")
    const balance = Number(current.rows[0].loyalty_points || 0)
    if (balance < cost) throw new Error(`O cliente precisa de ${cost} pontos para resgatar este benefício.`)

    const updated = await client.query<{ loyalty_points: number }>(
      `UPDATE sf_customer_accounts SET loyalty_points = loyalty_points - $3, updated_at = now() WHERE organization_id = $1 AND id = $2 RETURNING loyalty_points`,
      [session.organizationId, accountId, cost],
    )
    const nextBalance = Number(updated.rows[0]?.loyalty_points || 0)
    await client.query(
      `
        INSERT INTO sf_loyalty_ledger (
          organization_id, customer_id, kind, points, balance_after,
          reason, created_by_user_id, created_at
        )
        VALUES ($1, $2, 'redeem', $3, $4, $5, $6, now())
      `,
      [session.organizationId, accountId, -cost, nextBalance, reason, session.userId],
    )
    await client.query("COMMIT")
    await audit(session, "loyalty.redeemed", "customer_account", String(accountId), {
      points: cost,
      balanceAfter: nextBalance,
      reward: reason,
    })
    return nextBalance
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

const validChannels = new Set<CrmCampaignChannel>(["manual", "whatsapp", "email", "sms"])
const validSegments = new Set<CrmAudienceSegment>([
  "all", "new", "repeat", "frequent", "elite", "active", "sleeping", "inactive", "never",
])

export async function createCrmCampaign(
  session: TenantAdminSession,
  input: {
    name: string
    channel: CrmCampaignChannel
    audienceSegment: CrmAudienceSegment
    message: string
    couponCode?: string
    scheduledFor?: string | null
  },
) {
  await assertCrmAvailable(session)
  const name = String(input.name || "").trim().slice(0, 120)
  const message = String(input.message || "").trim().slice(0, 4000)
  if (name.length < 3) throw new Error("Informe um nome para a campanha.")
  if (message.length < 3) throw new Error("Informe a mensagem da campanha.")
  if (!validChannels.has(input.channel)) throw new Error("Canal de campanha inválido.")
  if (!validSegments.has(input.audienceSegment)) throw new Error("Segmento de campanha inválido.")

  let scheduledFor: string | null = null
  if (input.scheduledFor) {
    const parsed = new Date(input.scheduledFor)
    if (Number.isNaN(parsed.getTime())) throw new Error("Agendamento inválido.")
    scheduledFor = parsed.toISOString()
  }

  const result = await getPostgresPool().query<{ id: string }>(
    `
      INSERT INTO sf_crm_campaigns (
        organization_id, name, channel, status, audience_segment,
        message, coupon_code, scheduled_for, created_by_user_id,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, now(), now())
      RETURNING id
    `,
    [
      session.organizationId,
      name,
      input.channel,
      input.audienceSegment,
      message,
      String(input.couponCode || "").trim().toUpperCase().slice(0, 60) || null,
      scheduledFor,
      session.userId,
    ],
  )
  const id = result.rows[0]?.id
  await audit(session, "crm.campaign.created", "crm_campaign", id || null, {
    channel: input.channel,
    audienceSegment: input.audienceSegment,
  })
  return id
}

export async function setCrmCampaignStatus(
  session: TenantAdminSession,
  input: { campaignId: string; status: CrmCampaignStatus },
) {
  await assertCrmAvailable(session)
  if (!["draft", "ready", "archived"].includes(input.status)) {
    throw new Error("Status de campanha inválido.")
  }
  const result = await getPostgresPool().query(
    `
      UPDATE sf_crm_campaigns
      SET status = $3, updated_at = now()
      WHERE organization_id = $1 AND id = $2
    `,
    [session.organizationId, input.campaignId, input.status],
  )
  if (!result.rowCount) throw new Error("Campanha não encontrada.")
  await audit(session, "crm.campaign.status_changed", "crm_campaign", input.campaignId, {
    status: input.status,
  })
}

export async function crmHealth(session: TenantAdminSession) {
  const [tables, state] = await Promise.all([
    getPostgresPool().query<{
      profiles: string | null
      ledger: string | null
      campaigns: string | null
      customers: string | null
      orders: string | null
    }>(
      `
        SELECT
          to_regclass('public.sf_crm_customer_profiles')::text AS profiles,
          to_regclass('public.sf_loyalty_ledger')::text AS ledger,
          to_regclass('public.sf_crm_campaigns')::text AS campaigns,
          to_regclass('public.sf_customer_accounts')::text AS customers,
          to_regclass('public.sf_orders')::text AS orders
      `,
    ),
    billingState(session),
  ])
  const row = tables.rows[0]
  const schemaReady = Boolean(row?.profiles && row.ledger && row.campaigns && row.customers && row.orders)

  let counts = { profiles: 0, ledgerEntries: 0, campaigns: 0, marketingOptIn: 0 }
  if (schemaReady) {
    const result = await getPostgresPool().query<{
      profiles: number
      ledger_entries: number
      campaigns: number
      marketing_opt_in: number
    }>(
      `
        SELECT
          (SELECT COUNT(*)::int FROM sf_crm_customer_profiles WHERE organization_id = $1) AS profiles,
          (SELECT COUNT(*)::int FROM sf_loyalty_ledger WHERE organization_id = $1) AS ledger_entries,
          (SELECT COUNT(*)::int FROM sf_crm_campaigns WHERE organization_id = $1) AS campaigns,
          (SELECT COUNT(*)::int FROM sf_crm_customer_profiles WHERE organization_id = $1 AND marketing_opt_in = true) AS marketing_opt_in
      `,
      [session.organizationId],
    )
    counts = {
      profiles: Number(result.rows[0]?.profiles || 0),
      ledgerEntries: Number(result.rows[0]?.ledger_entries || 0),
      campaigns: Number(result.rows[0]?.campaigns || 0),
      marketingOptIn: Number(result.rows[0]?.marketing_opt_in || 0),
    }
  }

  return {
    schemaReady,
    entitlementEnabled: state.entitlementEnabled,
    subscriptionActive: state.subscriptionActive,
    organizationLinked: Boolean(state.billing.account),
    counts,
  }
}
