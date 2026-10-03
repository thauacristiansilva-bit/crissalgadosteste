import { getPostgresPool } from "@/lib/postgres"
import type { TenantAdminSession } from "@/lib/tenant-access"

const ticketStatuses = new Set(["new", "open", "waiting_customer", "resolved", "closed"])
const priorities = new Set(["low", "normal", "high", "urgent"])
const campaignAudiences = new Set(["all", "new", "repeat", "frequent", "elite", "active", "sleeping", "inactive", "never"])
const campaignChannels = new Set(["email", "whatsapp", "both", "in_app"])

function cleanText(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max)
}

function nullableText(value: unknown, max = 500) {
  const text = cleanText(value, max)
  return text || null
}

export async function createOrganizationNotification(input: {
  organizationId: string
  userId?: string | null
  type: string
  title: string
  body?: string | null
  severity?: "info" | "success" | "warning" | "critical"
  linkSection?: string | null
  sourceEntityType?: string | null
  sourceEntityId?: string | null
}) {
  await getPostgresPool().query(
    `INSERT INTO sf_admin_notifications (
       organization_id, user_id, type, title, body, severity, link_section,
       source_entity_type, source_entity_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.organizationId,
      input.userId || null,
      cleanText(input.type, 80) || "system",
      cleanText(input.title, 180),
      nullableText(input.body, 1200),
      input.severity || "info",
      nullableText(input.linkSection, 80),
      nullableText(input.sourceEntityType, 80),
      nullableText(input.sourceEntityId, 180),
    ],
  )
}

export async function getCommunicationCenterSnapshot(session: TenantAdminSession) {
  const [tickets, notifications, campaigns, preferences] = await Promise.all([
    getPostgresPool().query<{
      id: string
      subject: string
      customer_name: string | null
      customer_email: string | null
      customer_phone: string | null
      source: string
      status: string
      priority: string
      assigned_user_id: string | null
      assigned_user_name: string | null
      created_by_user_id: string | null
      last_message_at: Date
      resolved_at: Date | null
      created_at: Date
      updated_at: Date
      message_count: string | number
    }>(
      `SELECT t.id, t.subject, t.customer_name, t.customer_email, t.customer_phone,
              t.source, t.status, t.priority, t.assigned_user_id,
              u.email AS assigned_user_name, t.created_by_user_id,
              t.last_message_at, t.resolved_at, t.created_at, t.updated_at,
              COUNT(m.id) AS message_count
       FROM sf_support_tickets t
       LEFT JOIN sf_users u ON u.id = t.assigned_user_id
       LEFT JOIN sf_support_ticket_messages m
         ON m.ticket_id = t.id AND m.organization_id = t.organization_id
       WHERE t.organization_id = $1
       GROUP BY t.id, u.email
       ORDER BY
         CASE t.status WHEN 'new' THEN 1 WHEN 'open' THEN 2 WHEN 'waiting_customer' THEN 3 WHEN 'resolved' THEN 4 ELSE 5 END,
         CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
         t.last_message_at DESC
       LIMIT 150`,
      [session.organizationId],
    ),
    getPostgresPool().query<{
      id: string
      type: string
      title: string
      body: string | null
      severity: string
      link_section: string | null
      source_entity_type: string | null
      source_entity_id: string | null
      read_at: Date | null
      created_at: Date
    }>(
      `SELECT id, type, title, body, severity, link_section,
              source_entity_type, source_entity_id, read_at, created_at
       FROM sf_admin_notifications
       WHERE organization_id = $1
         AND (user_id IS NULL OR user_id = $2)
       ORDER BY created_at DESC
       LIMIT 120`,
      [session.organizationId, session.userId],
    ),
    getPostgresPool().query<{
      id: string
      name: string
      audience: string
      channel: string
      status: string
      subject: string | null
      body: string
      coupon_code: string | null
      scheduled_at: Date | null
      sent_at: Date | null
      created_at: Date
      updated_at: Date
    }>(
      `SELECT id, name, audience, channel, status, subject, body, coupon_code,
              scheduled_at, sent_at, created_at, updated_at
       FROM sf_communication_campaigns
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [session.organizationId],
    ),
    getPostgresPool().query<{
      in_app_enabled: boolean
      email_enabled: boolean
      whatsapp_enabled: boolean
      sms_enabled: boolean
      destination_email: string | null
      destination_phone: string | null
      notify_new_ticket: boolean
      notify_customer_reply: boolean
      notify_payment_issue: boolean
      notify_handoff: boolean
      notify_contract: boolean
      notify_printer: boolean
      notify_low_stock: boolean
    }>(
      `SELECT in_app_enabled, email_enabled, whatsapp_enabled, sms_enabled,
              destination_email, destination_phone,
              notify_new_ticket, notify_customer_reply, notify_payment_issue,
              notify_handoff, notify_contract, notify_printer, notify_low_stock
       FROM sf_notification_preferences
       WHERE organization_id = $1 AND user_id = $2`,
      [session.organizationId, session.userId],
    ),
  ])

  return {
    tickets: tickets.rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      source: row.source,
      status: row.status,
      priority: row.priority,
      assignedUserId: row.assigned_user_id,
      assignedUserName: row.assigned_user_name,
      messageCount: Number(row.message_count || 0),
      lastMessageAt: row.last_message_at.toISOString(),
      resolvedAt: row.resolved_at?.toISOString() || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })),
    notifications: notifications.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      severity: row.severity,
      linkSection: row.link_section,
      sourceEntityType: row.source_entity_type,
      sourceEntityId: row.source_entity_id,
      readAt: row.read_at?.toISOString() || null,
      createdAt: row.created_at.toISOString(),
    })),
    campaigns: campaigns.rows.map((row) => ({
      id: row.id,
      name: row.name,
      audience: row.audience,
      channel: row.channel,
      status: row.status,
      subject: row.subject,
      body: row.body,
      couponCode: row.coupon_code,
      scheduledAt: row.scheduled_at?.toISOString() || null,
      sentAt: row.sent_at?.toISOString() || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })),
    preferences: preferences.rows[0]
      ? {
          inAppEnabled: preferences.rows[0].in_app_enabled,
          emailEnabled: preferences.rows[0].email_enabled,
          whatsappEnabled: preferences.rows[0].whatsapp_enabled,
          smsEnabled: preferences.rows[0].sms_enabled,
          destinationEmail: preferences.rows[0].destination_email || session.email,
          destinationPhone: preferences.rows[0].destination_phone || "",
          notifyNewTicket: preferences.rows[0].notify_new_ticket,
          notifyCustomerReply: preferences.rows[0].notify_customer_reply,
          notifyPaymentIssue: preferences.rows[0].notify_payment_issue,
          notifyHandoff: preferences.rows[0].notify_handoff,
          notifyContract: preferences.rows[0].notify_contract,
          notifyPrinter: preferences.rows[0].notify_printer,
          notifyLowStock: preferences.rows[0].notify_low_stock,
        }
      : {
          inAppEnabled: true,
          emailEnabled: true,
          whatsappEnabled: false,
          smsEnabled: false,
          destinationEmail: session.email,
          destinationPhone: "",
          notifyNewTicket: true,
          notifyCustomerReply: true,
          notifyPaymentIssue: true,
          notifyHandoff: true,
          notifyContract: true,
          notifyPrinter: true,
          notifyLowStock: true,
        },
  }
}

export async function getTicketMessages(session: TenantAdminSession, ticketId: string) {
  const ticket = await getPostgresPool().query<{ id: string }>(
    `SELECT id FROM sf_support_tickets WHERE id = $1 AND organization_id = $2`,
    [ticketId, session.organizationId],
  )
  if (!ticket.rows[0]) throw new Error("Chamado não encontrado.")

  const result = await getPostgresPool().query<{
    id: string
    author_type: string
    channel: string
    body: string
    created_by_user_id: string | null
    author_email: string | null
    created_at: Date
  }>(
    `SELECT m.id, m.author_type, m.channel, m.body, m.created_by_user_id,
            u.email AS author_email, m.created_at
     FROM sf_support_ticket_messages m
     LEFT JOIN sf_users u ON u.id = m.created_by_user_id
     WHERE m.organization_id = $1 AND m.ticket_id = $2
     ORDER BY m.created_at ASC`,
    [session.organizationId, ticketId],
  )

  return result.rows.map((row) => ({
    id: row.id,
    authorType: row.author_type,
    channel: row.channel,
    body: row.body,
    authorEmail: row.author_email,
    createdAt: row.created_at.toISOString(),
  }))
}

export async function createSupportTicket(session: TenantAdminSession, input: Record<string, unknown>) {
  const subject = cleanText(input.subject, 180)
  if (!subject) throw new Error("Informe o assunto do chamado.")
  const message = cleanText(input.message, 5000)
  const priority = priorities.has(String(input.priority)) ? String(input.priority) : "normal"

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const created = await client.query<{ id: string }>(
      `INSERT INTO sf_support_tickets (
         organization_id, subject, customer_name, customer_email, customer_phone,
         source, status, priority, created_by_user_id
       ) VALUES ($1,$2,$3,$4,$5,'manual','new',$6,$7)
       RETURNING id`,
      [
        session.organizationId,
        subject,
        nullableText(input.customerName, 160),
        nullableText(input.customerEmail, 200),
        nullableText(input.customerPhone, 40),
        priority,
        session.userId,
      ],
    )
    const id = created.rows[0]?.id
    if (!id) throw new Error("Não foi possível criar o chamado.")
    if (message) {
      await client.query(
        `INSERT INTO sf_support_ticket_messages (
           organization_id, ticket_id, author_type, channel, body, created_by_user_id
         ) VALUES ($1,$2,'staff','internal',$3,$4)`,
        [session.organizationId, id, message, session.userId],
      )
    }
    await client.query("COMMIT")
    await createOrganizationNotification({
      organizationId: session.organizationId,
      type: "ticket_created",
      title: "Novo chamado criado",
      body: subject,
      severity: priority === "urgent" ? "critical" : priority === "high" ? "warning" : "info",
      linkSection: "communication",
      sourceEntityType: "support_ticket",
      sourceEntityId: id,
    })
    return { id }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function addTicketMessage(session: TenantAdminSession, input: Record<string, unknown>) {
  const ticketId = cleanText(input.ticketId, 80)
  const body = cleanText(input.body, 5000)
  if (!ticketId || !body) throw new Error("Mensagem inválida.")

  const ticket = await getPostgresPool().query<{ id: string; subject: string }>(
    `SELECT id, subject FROM sf_support_tickets WHERE id = $1 AND organization_id = $2`,
    [ticketId, session.organizationId],
  )
  if (!ticket.rows[0]) throw new Error("Chamado não encontrado.")

  await getPostgresPool().query(
    `INSERT INTO sf_support_ticket_messages (
       organization_id, ticket_id, author_type, channel, body, created_by_user_id
     ) VALUES ($1,$2,'staff','internal',$3,$4)`,
    [session.organizationId, ticketId, body, session.userId],
  )
  await getPostgresPool().query(
    `UPDATE sf_support_tickets
     SET status = CASE WHEN status = 'new' THEN 'open' ELSE status END,
         last_message_at = now(), updated_at = now()
     WHERE id = $1 AND organization_id = $2`,
    [ticketId, session.organizationId],
  )
  return { ok: true }
}

export async function updateSupportTicket(session: TenantAdminSession, input: Record<string, unknown>) {
  const ticketId = cleanText(input.ticketId, 80)
  const status = cleanText(input.status, 40)
  const priority = cleanText(input.priority, 40)
  if (!ticketId) throw new Error("Chamado inválido.")
  if (status && !ticketStatuses.has(status)) throw new Error("Status inválido.")
  if (priority && !priorities.has(priority)) throw new Error("Prioridade inválida.")

  await getPostgresPool().query(
    `UPDATE sf_support_tickets
     SET status = COALESCE($3, status),
         priority = COALESCE($4, priority),
         assigned_user_id = CASE WHEN $5::boolean THEN $2 ELSE assigned_user_id END,
         resolved_at = CASE
           WHEN COALESCE($3, status) IN ('resolved','closed') THEN COALESCE(resolved_at, now())
           ELSE NULL
         END,
         updated_at = now()
     WHERE id = $1 AND organization_id = $6`,
    [
      ticketId,
      session.userId,
      status || null,
      priority || null,
      Boolean(input.assignToMe),
      session.organizationId,
    ],
  )
  return { ok: true }
}

export async function markNotificationRead(session: TenantAdminSession, notificationId: string) {
  await getPostgresPool().query(
    `UPDATE sf_admin_notifications
     SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND organization_id = $2 AND (user_id IS NULL OR user_id = $3)`,
    [notificationId, session.organizationId, session.userId],
  )
  return { ok: true }
}

export async function saveNotificationPreferences(session: TenantAdminSession, input: Record<string, unknown>) {
  await getPostgresPool().query(
    `INSERT INTO sf_notification_preferences (
       organization_id, user_id, in_app_enabled, email_enabled, whatsapp_enabled, sms_enabled,
       destination_email, destination_phone,
       notify_new_ticket, notify_customer_reply, notify_payment_issue, notify_handoff,
       notify_contract, notify_printer, notify_low_stock, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
     ON CONFLICT (organization_id, user_id) DO UPDATE SET
       in_app_enabled = EXCLUDED.in_app_enabled,
       email_enabled = EXCLUDED.email_enabled,
       whatsapp_enabled = EXCLUDED.whatsapp_enabled,
       sms_enabled = EXCLUDED.sms_enabled,
       destination_email = EXCLUDED.destination_email,
       destination_phone = EXCLUDED.destination_phone,
       notify_new_ticket = EXCLUDED.notify_new_ticket,
       notify_customer_reply = EXCLUDED.notify_customer_reply,
       notify_payment_issue = EXCLUDED.notify_payment_issue,
       notify_handoff = EXCLUDED.notify_handoff,
       notify_contract = EXCLUDED.notify_contract,
       notify_printer = EXCLUDED.notify_printer,
       notify_low_stock = EXCLUDED.notify_low_stock,
       updated_at = now()`,
    [
      session.organizationId,
      session.userId,
      input.inAppEnabled !== false,
      input.emailEnabled !== false,
      Boolean(input.whatsappEnabled),
      Boolean(input.smsEnabled),
      nullableText(input.destinationEmail, 200) || session.email,
      nullableText(input.destinationPhone, 40),
      input.notifyNewTicket !== false,
      input.notifyCustomerReply !== false,
      input.notifyPaymentIssue !== false,
      input.notifyHandoff !== false,
      input.notifyContract !== false,
      input.notifyPrinter !== false,
      input.notifyLowStock !== false,
    ],
  )
  return { ok: true }
}

export async function createCommunicationCampaign(session: TenantAdminSession, input: Record<string, unknown>) {
  const name = cleanText(input.name, 160)
  const body = cleanText(input.body, 8000)
  if (!name || !body) throw new Error("Informe nome e mensagem da campanha.")
  const audience = campaignAudiences.has(String(input.audience)) ? String(input.audience) : "all"
  const channel = campaignChannels.has(String(input.channel)) ? String(input.channel) : "email"
  const scheduledAt = nullableText(input.scheduledAt, 80)
  const status = scheduledAt ? "scheduled" : "draft"

  const result = await getPostgresPool().query<{ id: string }>(
    `INSERT INTO sf_communication_campaigns (
       organization_id, name, audience, channel, status, subject, body,
       coupon_code, scheduled_at, created_by_user_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      session.organizationId,
      name,
      audience,
      channel,
      status,
      nullableText(input.subject, 200),
      body,
      nullableText(input.couponCode, 80),
      scheduledAt ? new Date(scheduledAt) : null,
      session.userId,
    ],
  )
  return { id: result.rows[0]?.id }
}
