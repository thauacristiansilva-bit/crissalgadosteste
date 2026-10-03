import { getPostgresPool } from "@/lib/postgres"

export type PlatformInsights = {
  generatedAt: string
  metrics: {
    signedContracts: number
    approvedContracts: number
    contractEmailsPending: number
    contractEmailFailures: number
    whatsappActiveConnections: number
    whatsappErrorConnections: number
    whatsappOpenConversations: number
    whatsappHumanHandoffs: number
    openTickets: number
    urgentTickets: number
    scheduledCampaigns: number
    draftCampaigns: number
    failedMessages: number
    queuedMessages: number
  }
  contractAlerts: Array<{
    id: string
    email: string | null
    planCode: string
    billingCycle: string
    status: string
    paymentMethod: string
    signedAt: string
    emailError: string | null
  }>
  whatsappAlerts: Array<{
    id: string
    organizationName: string
    name: string
    status: string
    lastError: string | null
    updatedAt: string
  }>
  handoffs: Array<{
    organizationName: string
    contactName: string
    contactPhone: string
    reason: string | null
    updatedAt: string
  }>
  tickets: Array<{
    id: string
    organizationName: string
    subject: string
    priority: string
    status: string
    updatedAt: string
  }>
}

type QueryResult<T extends Record<string, unknown>> = { rows: T[] }

async function safeQuery<T extends Record<string, unknown>>(
  sql: string,
  fallback: T[] = [],
): Promise<QueryResult<T>> {
  try {
    const result = await getPostgresPool().query<T>(sql)
    return { rows: result.rows }
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (code === "42P01" || code === "42703") return { rows: fallback }
    throw error
  }
}

function asNumber(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function iso(value: Date | string | null | undefined) {
  if (!value) return ""
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString()
}

export async function getPlatformInsights(): Promise<PlatformInsights> {
  const [contractsMetric, whatsappMetric, conversationsMetric, ticketsMetric, campaignsMetric, outboxMetric, contractAlerts, whatsappAlerts, handoffs, tickets] = await Promise.all([
    safeQuery<{ total: string; approved: string; pending_email: string; email_failures: string }>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'approved')::text AS approved,
        COUNT(*) FILTER (WHERE status = 'approved' AND email_sent_at IS NULL)::text AS pending_email,
        COUNT(*) FILTER (WHERE email_error IS NOT NULL AND btrim(email_error) <> '')::text AS email_failures
      FROM sf_signed_contracts
    `),
    safeQuery<{ active: string; error: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE provider = 'whatsapp_meta' AND status = 'active')::text AS active,
        COUNT(*) FILTER (WHERE provider = 'whatsapp_meta' AND status = 'error')::text AS error
      FROM sf_integration_connections
    `),
    safeQuery<{ open: string; handoffs: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE status <> 'closed')::text AS open,
        COUNT(*) FILTER (WHERE status <> 'closed' AND (handoff_requested = true OR ai_mode = 'human'))::text AS handoffs
      FROM sf_whatsapp_conversations
    `),
    safeQuery<{ open: string; urgent: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('new','open','waiting_customer'))::text AS open,
        COUNT(*) FILTER (WHERE status IN ('new','open','waiting_customer') AND priority = 'urgent')::text AS urgent
      FROM sf_support_tickets
    `),
    safeQuery<{ scheduled: string; draft: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'scheduled')::text AS scheduled,
        COUNT(*) FILTER (WHERE status = 'draft')::text AS draft
      FROM sf_communication_campaigns
    `),
    safeQuery<{ failed: string; queued: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
        COUNT(*) FILTER (WHERE status IN ('queued','processing'))::text AS queued
      FROM sf_integration_outbox
    `),
    safeQuery<{
      id: string; email: string | null; plan_code: string; billing_cycle: string; status: string;
      payment_method: string; signed_at: Date | string; email_error: string | null
    }>(`
      SELECT c.id, u.email, c.plan_code, c.billing_cycle, c.status, c.payment_method, c.signed_at, c.email_error
      FROM sf_signed_contracts c
      LEFT JOIN sf_users u ON u.id = c.user_id
      WHERE (c.status = 'approved' AND c.email_sent_at IS NULL)
         OR (c.email_error IS NOT NULL AND btrim(c.email_error) <> '')
      ORDER BY c.updated_at DESC
      LIMIT 30
    `),
    safeQuery<{
      id: string; organization_name: string; name: string; status: string; last_error: string | null; updated_at: Date | string
    }>(`
      SELECT i.id, o.trade_name AS organization_name, i.name, i.status, i.last_error, i.updated_at
      FROM sf_integration_connections i
      INNER JOIN sf_organizations o ON o.id = i.organization_id
      WHERE i.provider = 'whatsapp_meta' AND (i.status = 'error' OR i.last_error IS NOT NULL)
      ORDER BY COALESCE(i.last_error_at, i.updated_at) DESC
      LIMIT 30
    `),
    safeQuery<{
      organization_name: string; contact_name: string; contact_phone: string; handoff_reason: string | null; updated_at: Date | string
    }>(`
      SELECT o.trade_name AS organization_name, c.contact_name, c.contact_phone, c.handoff_reason, c.updated_at
      FROM sf_whatsapp_conversations c
      INNER JOIN sf_organizations o ON o.id = c.organization_id
      WHERE c.status <> 'closed' AND (c.handoff_requested = true OR c.ai_mode = 'human')
      ORDER BY c.updated_at DESC
      LIMIT 40
    `),
    safeQuery<{
      id: string; organization_name: string; subject: string; priority: string; status: string; updated_at: Date | string
    }>(`
      SELECT t.id, o.trade_name AS organization_name, t.subject, t.priority, t.status, t.updated_at
      FROM sf_support_tickets t
      INNER JOIN sf_organizations o ON o.id = t.organization_id
      WHERE t.status IN ('new','open','waiting_customer')
      ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, t.updated_at DESC
      LIMIT 40
    `),
  ])

  const cm = contractsMetric.rows[0]
  const wm = whatsappMetric.rows[0]
  const conv = conversationsMetric.rows[0]
  const tm = ticketsMetric.rows[0]
  const cam = campaignsMetric.rows[0]
  const out = outboxMetric.rows[0]

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      signedContracts: asNumber(cm?.total),
      approvedContracts: asNumber(cm?.approved),
      contractEmailsPending: asNumber(cm?.pending_email),
      contractEmailFailures: asNumber(cm?.email_failures),
      whatsappActiveConnections: asNumber(wm?.active),
      whatsappErrorConnections: asNumber(wm?.error),
      whatsappOpenConversations: asNumber(conv?.open),
      whatsappHumanHandoffs: asNumber(conv?.handoffs),
      openTickets: asNumber(tm?.open),
      urgentTickets: asNumber(tm?.urgent),
      scheduledCampaigns: asNumber(cam?.scheduled),
      draftCampaigns: asNumber(cam?.draft),
      failedMessages: asNumber(out?.failed),
      queuedMessages: asNumber(out?.queued),
    },
    contractAlerts: contractAlerts.rows.map((row) => ({
      id: row.id,
      email: row.email,
      planCode: row.plan_code,
      billingCycle: row.billing_cycle,
      status: row.status,
      paymentMethod: row.payment_method,
      signedAt: iso(row.signed_at),
      emailError: row.email_error,
    })),
    whatsappAlerts: whatsappAlerts.rows.map((row) => ({
      id: row.id,
      organizationName: row.organization_name,
      name: row.name,
      status: row.status,
      lastError: row.last_error,
      updatedAt: iso(row.updated_at),
    })),
    handoffs: handoffs.rows.map((row) => ({
      organizationName: row.organization_name,
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      reason: row.handoff_reason,
      updatedAt: iso(row.updated_at),
    })),
    tickets: tickets.rows.map((row) => ({
      id: row.id,
      organizationName: row.organization_name,
      subject: row.subject,
      priority: row.priority,
      status: row.status,
      updatedAt: iso(row.updated_at),
    })),
  }
}
