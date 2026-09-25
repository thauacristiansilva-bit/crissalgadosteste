import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { getBillingSnapshotForOrganization } from "@/lib/billing-db"
import { getCrmOverview, type CrmAudienceSegment, type CrmCustomer } from "@/lib/crm-db"
import { assertDemoActionAllowed } from "@/lib/demo-policy"
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
  integrationEncryptionConfigured,
} from "@/lib/integration-crypto"
import {
  dispatchIntegrationMessage,
  type IntegrationChannel,
  type IntegrationProvider,
} from "@/lib/integration-providers"
import { getPostgresPool } from "@/lib/postgres"
import type { TenantAdminSession } from "@/lib/tenant-access"
import { permissionListHas } from "@/lib/operational-permissions"

export type IntegrationConnectionStatus = "disabled" | "active" | "error"

export type IntegrationConnection = {
  id: string
  name: string
  channel: IntegrationChannel
  provider: IntegrationProvider
  status: IntegrationConnectionStatus
  settings: Record<string, unknown>
  credentialConfigured: boolean
  lastSuccessAt: string | null
  lastErrorAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function cleanText(value: unknown, max = 200) {
  return String(value || "").trim().slice(0, max)
}

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function bool(value: unknown) {
  return value === true
}

export function canAccessIntegrations(session: TenantAdminSession) {
  return permissionListHas(session.operationalPermissions, "integrations.manage")
}

async function billingState(session: TenantAdminSession) {
  const billing = await getBillingSnapshotForOrganization(session.organizationId)
  const subscriptionActive =
    billing.account?.status === "active" &&
    ["active", "trialing"].includes(billing.subscription?.status || "")
  return {
    billing,
    subscriptionActive,
    entitlementEnabled: Boolean(billing.entitlements.integrations),
    crmEnabled: Boolean(billing.entitlements.loyalty),
  }
}

async function assertIntegrationsAvailable(session: TenantAdminSession) {
  if (!canAccessIntegrations(session)) {
    throw new Error("Seu perfil não possui acesso à configuração de integrações.")
  }
  const state = await billingState(session)
  if (!state.subscriptionActive) throw new Error("A assinatura precisa estar ativa para usar integrações.")
  if (!state.entitlementEnabled) throw new Error("Integrações não estão incluídas no plano atual.")
  return state
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

function providerChannel(provider: IntegrationProvider): IntegrationChannel {
  if (provider === "resend") return "email"
  if (provider === "twilio") return "sms"
  if (provider === "whatsapp_meta") return "whatsapp"
  return "webhook"
}

function sanitizedConnectionSettings(provider: IntegrationProvider, input: Record<string, unknown>) {
  if (provider === "resend") {
    const from = cleanText(input.from, 320)
    if (!from || !from.includes("@")) throw new Error("Informe o remetente de e-mail configurado no provedor.")
    return { from }
  }
  if (provider === "twilio") {
    const from = cleanText(input.from, 80)
    const defaultCountryCode = cleanText(input.defaultCountryCode, 5).replace(/\D/g, "")
    if (!from) throw new Error("Informe o número remetente da Twilio.")
    if (!defaultCountryCode) throw new Error("Informe o código do país para os destinatários.")
    return { from, defaultCountryCode }
  }
  if (provider === "whatsapp_meta") {
    const apiVersion = cleanText(input.apiVersion, 20)
    const defaultCountryCode = cleanText(input.defaultCountryCode, 5).replace(/\D/g, "")
    const templateName = cleanText(input.templateName, 200)
    const languageCode = cleanText(input.languageCode, 20)
    if (!/^v\d+\.\d+$/.test(apiVersion)) throw new Error("Informe a versão da Graph API no formato vNN.N.")
    if (!defaultCountryCode) throw new Error("Informe o código do país para os destinatários.")
    if (!templateName || !languageCode) throw new Error("Informe o template aprovado e o idioma usados no WhatsApp.")
    return { apiVersion, defaultCountryCode, templateName, languageCode }
  }
  const endpointUrl = cleanText(input.endpointUrl, 1000)
  if (!endpointUrl) throw new Error("Informe o endpoint HTTPS do webhook.")
  let parsed: URL
  try {
    parsed = new URL(endpointUrl)
  } catch {
    throw new Error("Endpoint de webhook inválido.")
  }
  if (parsed.protocol !== "https:") throw new Error("Webhook de saída exige HTTPS.")
  return { endpointUrl: parsed.toString() }
}

function sanitizedCredentials(provider: IntegrationProvider, input: Record<string, unknown>) {
  if (provider === "resend") {
    const apiKey = cleanText(input.apiKey, 500)
    if (!apiKey) throw new Error("Informe a chave da Resend.")
    return { apiKey }
  }
  if (provider === "twilio") {
    const accountSid = cleanText(input.accountSid, 100)
    const authToken = cleanText(input.authToken, 500)
    if (!accountSid || !authToken) throw new Error("Informe Account SID e Auth Token da Twilio.")
    return { accountSid, authToken }
  }
  if (provider === "whatsapp_meta") {
    const accessToken = cleanText(input.accessToken, 4000)
    const phoneNumberId = cleanText(input.phoneNumberId, 100)
    if (!accessToken || !phoneNumberId) throw new Error("Informe Access Token e Phone Number ID da Meta.")
    return { accessToken, phoneNumberId }
  }
  const signingSecret = cleanText(input.signingSecret, 1000)
  if (signingSecret.length < 16) throw new Error("O segredo de assinatura do webhook precisa ter pelo menos 16 caracteres.")
  return { signingSecret }
}

export async function getIntegrationsOverview(session: TenantAdminSession) {
  const state = await assertIntegrationsAvailable(session)
  const [connections, queue, campaigns] = await Promise.all([
    getPostgresPool().query<{
      id: string
      name: string
      channel: IntegrationChannel
      provider: IntegrationProvider
      status: IntegrationConnectionStatus
      settings: Record<string, unknown>
      encrypted_credentials: string
      last_success_at: Date | string | null
      last_error_at: Date | string | null
      last_error: string | null
      created_at: Date | string
      updated_at: Date | string
    }>(
      `
        SELECT id, name, channel, provider, status, settings, encrypted_credentials,
               last_success_at, last_error_at, last_error, created_at, updated_at
        FROM sf_integration_connections
        WHERE organization_id = $1
        ORDER BY updated_at DESC, created_at DESC
      `,
      [session.organizationId],
    ),
    getPostgresPool().query<{
      id: string
      campaign_id: string | null
      connection_name: string
      channel: IntegrationChannel
      recipient: string
      status: "queued" | "processing" | "sent" | "failed" | "cancelled"
      attempts: number
      max_attempts: number
      provider_status: string | null
      last_error: string | null
      next_attempt_at: Date | string
      sent_at: Date | string | null
      created_at: Date | string
    }>(
      `
        SELECT o.id, o.campaign_id, c.name AS connection_name, o.channel, o.recipient,
               o.status, o.attempts, o.max_attempts, o.provider_status, o.last_error,
               o.next_attempt_at, o.sent_at, o.created_at
        FROM sf_integration_outbox o
        INNER JOIN sf_integration_connections c ON c.id = o.connection_id
        WHERE o.organization_id = $1
        ORDER BY o.created_at DESC
        LIMIT 100
      `,
      [session.organizationId],
    ),
    getPostgresPool().query<{
      id: string
      name: string
      channel: "manual" | "whatsapp" | "email" | "sms"
      status: "draft" | "ready" | "archived"
      audience_segment: CrmAudienceSegment
      scheduled_for: Date | string | null
      updated_at: Date | string
    }>(
      `
        SELECT id, name, channel, status, audience_segment, scheduled_for, updated_at
        FROM sf_crm_campaigns
        WHERE organization_id = $1
        ORDER BY updated_at DESC
        LIMIT 50
      `,
      [session.organizationId],
    ),
  ])

  const normalizedConnections: IntegrationConnection[] = connections.rows.map((row) => ({
    id: row.id,
    name: row.name,
    channel: row.channel,
    provider: row.provider,
    status: row.status,
    settings: jsonObject(row.settings),
    credentialConfigured: Boolean(row.encrypted_credentials),
    lastSuccessAt: iso(row.last_success_at),
    lastErrorAt: iso(row.last_error_at),
    lastError: row.last_error,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  }))

  return {
    organization: { id: session.organizationId, name: session.organizationName },
    billing: {
      planCode: state.billing.subscription?.planCode || null,
      subscriptionActive: state.subscriptionActive,
      integrationsIncluded: state.entitlementEnabled,
      crmIncluded: state.crmEnabled,
    },
    runtime: {
      encryptionKeyConfigured: integrationEncryptionConfigured(),
      workerTokenConfigured: Boolean(process.env.INTEGRATION_WORKER_TOKEN?.trim()),
      webhookAllowlistConfigured: Boolean(process.env.INTEGRATION_WEBHOOK_ALLOWED_HOSTS?.trim()),
    },
    connections: normalizedConnections,
    campaigns: campaigns.rows.map((row) => ({
      id: row.id,
      name: row.name,
      channel: row.channel,
      status: row.status,
      audienceSegment: row.audience_segment,
      scheduledFor: iso(row.scheduled_for),
      updatedAt: iso(row.updated_at)!,
    })),
    queue: queue.rows.map((row) => ({
      id: row.id,
      campaignId: row.campaign_id,
      connectionName: row.connection_name,
      channel: row.channel,
      recipient: row.recipient,
      status: row.status,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      providerStatus: row.provider_status,
      lastError: row.last_error,
      nextAttemptAt: iso(row.next_attempt_at)!,
      sentAt: iso(row.sent_at),
      createdAt: iso(row.created_at)!,
    })),
    summary: {
      connections: normalizedConnections.length,
      activeConnections: normalizedConnections.filter((item) => item.status === "active").length,
      queued: queue.rows.filter((item) => item.status === "queued" || item.status === "processing").length,
      sent: queue.rows.filter((item) => item.status === "sent").length,
      failed: queue.rows.filter((item) => item.status === "failed").length,
    },
  }
}

export async function upsertIntegrationConnection(
  session: TenantAdminSession,
  input: {
    connectionId?: string | null
    name: string
    provider: IntegrationProvider
    settings?: Record<string, unknown>
    credentials?: Record<string, unknown>
    enabled?: boolean
  },
) {
  await assertIntegrationsAvailable(session)
  if (input.enabled) await assertDemoActionAllowed(session.organizationId, "dangerous-integration")
  if (!integrationEncryptionConfigured()) throw new Error("Configure INTEGRATION_ENCRYPTION_KEY antes de salvar credenciais.")

  const provider = input.provider
  if (!["resend", "twilio", "whatsapp_meta", "webhook"].includes(provider)) {
    throw new Error("Provedor de integração inválido.")
  }
  const name = cleanText(input.name, 120)
  if (name.length < 3) throw new Error("Informe um nome para a conexão.")
  const settings = sanitizedConnectionSettings(provider, jsonObject(input.settings))

  const existing = input.connectionId
    ? await getPostgresPool().query<{ encrypted_credentials: string; provider: IntegrationProvider }>(
        `SELECT encrypted_credentials, provider FROM sf_integration_connections WHERE organization_id = $1 AND id = $2 LIMIT 1`,
        [session.organizationId, input.connectionId],
      )
    : null

  if (input.connectionId && !existing?.rows[0]) throw new Error("Conexão não encontrada.")
  if (existing?.rows[0] && existing.rows[0].provider !== provider) {
    throw new Error("O provedor de uma conexão existente não pode ser alterado. Crie uma nova conexão.")
  }

  const credentialsInput = jsonObject(input.credentials)
  const hasCredentials = Object.values(credentialsInput).some((value) => cleanText(value, 10_000).length > 0)
  const encryptedCredentials = hasCredentials
    ? encryptIntegrationCredentials(sanitizedCredentials(provider, credentialsInput))
    : existing?.rows[0]?.encrypted_credentials
  if (!encryptedCredentials) throw new Error("Informe as credenciais do provedor.")

  const channel = providerChannel(provider)
  const status: IntegrationConnectionStatus = input.enabled ? "active" : "disabled"
  const result = input.connectionId
    ? await getPostgresPool().query<{ id: string }>(
        `
          UPDATE sf_integration_connections
          SET name = $3, channel = $4, settings = $5::jsonb,
              encrypted_credentials = $6, status = $7,
              last_error = NULL, updated_at = now()
          WHERE organization_id = $1 AND id = $2
          RETURNING id
        `,
        [
          session.organizationId,
          input.connectionId,
          name,
          channel,
          JSON.stringify(settings),
          encryptedCredentials,
          status,
        ],
      )
    : await getPostgresPool().query<{ id: string }>(
        `
          INSERT INTO sf_integration_connections (
            organization_id, name, channel, provider, status, settings,
            encrypted_credentials, credential_version, created_by_user_id,
            created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 1, $8, now(), now())
          RETURNING id
        `,
        [
          session.organizationId,
          name,
          channel,
          provider,
          status,
          JSON.stringify(settings),
          encryptedCredentials,
          session.userId,
        ],
      )

  const id = result.rows[0]?.id || input.connectionId || null
  await audit(session, input.connectionId ? "integration.connection.updated" : "integration.connection.created", "integration_connection", id, {
    provider,
    channel,
    status,
    credentialsChanged: hasCredentials,
  })
  return id
}

export async function setIntegrationConnectionStatus(
  session: TenantAdminSession,
  input: { connectionId: string; enabled: boolean },
) {
  await assertIntegrationsAvailable(session)
  if (input.enabled) {
    await assertDemoActionAllowed(session.organizationId, "dangerous-integration")
    if (!integrationEncryptionConfigured()) throw new Error("Configure INTEGRATION_ENCRYPTION_KEY antes de ativar integrações.")
  }
  const result = await getPostgresPool().query(
    `
      UPDATE sf_integration_connections
      SET status = $3, last_error = CASE WHEN $3 = 'active' THEN NULL ELSE last_error END, updated_at = now()
      WHERE organization_id = $1 AND id = $2
    `,
    [session.organizationId, input.connectionId, input.enabled ? "active" : "disabled"],
  )
  if (!result.rowCount) throw new Error("Conexão não encontrada.")
  await audit(session, "integration.connection.status_changed", "integration_connection", input.connectionId, {
    enabled: input.enabled,
  })
}

export async function deleteIntegrationConnection(session: TenantAdminSession, connectionId: string) {
  await assertIntegrationsAvailable(session)
  const history = await getPostgresPool().query(
    `
      SELECT 1
      FROM (
        SELECT connection_id FROM sf_integration_outbox WHERE organization_id = $1 AND connection_id = $2
        UNION ALL
        SELECT connection_id FROM sf_integration_webhook_events WHERE organization_id = $1 AND connection_id = $2
      ) history
      LIMIT 1
    `,
    [session.organizationId, connectionId],
  )
  if (history.rowCount) throw new Error("Esta conexão já possui histórico. Desative-a para preservar a auditoria; conexões usadas não podem ser excluídas.")
  const result = await getPostgresPool().query(
    `DELETE FROM sf_integration_connections WHERE organization_id = $1 AND id = $2`,
    [session.organizationId, connectionId],
  )
  if (!result.rowCount) throw new Error("Conexão não encontrada.")
  await audit(session, "integration.connection.deleted", "integration_connection", connectionId, {})
}

function matchesAudience(customer: CrmCustomer, segment: CrmAudienceSegment) {
  if (segment === "all") return true
  return customer.segment === segment || customer.lifecycle === segment
}

function campaignRecipient(channel: IntegrationChannel, customer: CrmCustomer) {
  if (channel === "email") return cleanText(customer.email, 320)
  if (channel === "sms" || channel === "whatsapp") return cleanText(customer.phone, 80)
  return customer.key
}

export async function enqueueCrmCampaign(
  session: TenantAdminSession,
  input: { campaignId: string; connectionId: string },
) {
  const state = await assertIntegrationsAvailable(session)
  await assertDemoActionAllowed(session.organizationId, "dangerous-integration")
  if (!state.crmEnabled) throw new Error("O módulo de CRM/fidelidade precisa estar incluído no plano para disparar campanhas.")

  const [campaignResult, connectionResult] = await Promise.all([
    getPostgresPool().query<{
      id: string
      name: string
      channel: "manual" | "whatsapp" | "email" | "sms"
      status: "draft" | "ready" | "archived"
      audience_segment: CrmAudienceSegment
      message: string
      scheduled_for: Date | string | null
    }>(
      `SELECT id, name, channel, status, audience_segment, message, scheduled_for FROM sf_crm_campaigns WHERE organization_id = $1 AND id = $2 LIMIT 1`,
      [session.organizationId, input.campaignId],
    ),
    getPostgresPool().query<{
      id: string
      channel: IntegrationChannel
      provider: IntegrationProvider
      status: IntegrationConnectionStatus
    }>(
      `SELECT id, channel, provider, status FROM sf_integration_connections WHERE organization_id = $1 AND id = $2 LIMIT 1`,
      [session.organizationId, input.connectionId],
    ),
  ])
  const campaign = campaignResult.rows[0]
  const connection = connectionResult.rows[0]
  if (!campaign) throw new Error("Campanha não encontrada.")
  if (campaign.status !== "ready") throw new Error("Marque a campanha como pronta no CRM antes de colocá-la na fila.")
  if (campaign.channel === "manual") throw new Error("Campanhas manuais não possuem disparo externo.")
  if (!connection || connection.status !== "active") throw new Error("Escolha uma conexão ativa.")
  if (connection.channel !== "webhook" && connection.channel !== campaign.channel) {
    throw new Error("O canal da conexão não corresponde ao canal da campanha.")
  }

  const crm = await getCrmOverview(session)
  const audience = crm.customers.filter((customer) =>
    customer.marketingOptIn && matchesAudience(customer, campaign.audience_segment),
  )
  const maxRecipients = Math.max(1, Math.min(5000, Number(process.env.INTEGRATION_CAMPAIGN_MAX_RECIPIENTS || "500")))
  if (audience.length > maxRecipients) {
    throw new Error(`A campanha possui ${audience.length} destinatários e excede o limite operacional de ${maxRecipients}.`)
  }

  let queued = 0
  let duplicates = 0
  let skipped = 0
  const scheduledFor = campaign.scheduled_for ? new Date(campaign.scheduled_for) : new Date()
  const nextAttemptAt = scheduledFor.getTime() > Date.now() ? scheduledFor.toISOString() : new Date().toISOString()

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    for (const customer of audience) {
      const recipient = campaignRecipient(connection.channel, customer)
      if (!recipient) {
        skipped += 1
        continue
      }
      const idempotencyKey = `campaign:${campaign.id}:connection:${connection.id}:customer:${customer.key}`
      const result = await client.query(
        `
          INSERT INTO sf_integration_outbox (
            organization_id, connection_id, campaign_id, customer_id,
            recipient_key, channel, recipient, subject, message, payload,
            status, attempts, max_attempts, next_attempt_at, idempotency_key,
            created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb,
            'queued', 0, 5, $11, $12, now(), now()
          )
          ON CONFLICT (organization_id, idempotency_key) DO NOTHING
        `,
        [
          session.organizationId,
          connection.id,
          campaign.id,
          customer.accountId,
          customer.key,
          connection.channel,
          recipient,
          campaign.name,
          campaign.message,
          JSON.stringify({
            campaignChannel: campaign.channel,
            audienceSegment: campaign.audience_segment,
            customerKey: customer.key,
          }),
          nextAttemptAt,
          idempotencyKey,
        ],
      )
      if (result.rowCount) queued += 1
      else duplicates += 1
    }
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  await audit(session, "integration.campaign.enqueued", "crm_campaign", campaign.id, {
    connectionId: connection.id,
    queued,
    duplicates,
    skipped,
    audience: audience.length,
  })
  return { queued, duplicates, skipped, audience: audience.length }
}

export async function cancelIntegrationJob(session: TenantAdminSession, jobId: string) {
  await assertIntegrationsAvailable(session)
  const result = await getPostgresPool().query(
    `
      UPDATE sf_integration_outbox
      SET status = 'cancelled', updated_at = now()
      WHERE organization_id = $1 AND id = $2 AND status = 'queued'
    `,
    [session.organizationId, jobId],
  )
  if (!result.rowCount) throw new Error("Envio não encontrado ou não pode mais ser cancelado.")
  await audit(session, "integration.outbox.cancelled", "integration_outbox", jobId, {})
}

function retryDelayMinutes(attempt: number) {
  const delays = [1, 5, 15, 60, 180]
  return delays[Math.max(0, Math.min(delays.length - 1, attempt - 1))]
}

type ClaimedJob = {
  id: string
  organization_id: string
  connection_id: string
  campaign_id: string | null
  recipient_key: string
  channel: IntegrationChannel
  recipient: string
  subject: string | null
  message: string
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
  idempotency_key: string
}

async function claimIntegrationJobs(limit: number) {
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `
        UPDATE sf_integration_outbox
        SET status = 'queued', locked_at = NULL, next_attempt_at = now(), updated_at = now(),
            last_error = COALESCE(last_error, 'Processamento anterior expirou e foi recuperado automaticamente.')
        WHERE status = 'processing' AND locked_at < now() - interval '10 minutes'
      `,
    )
    const result = await client.query<ClaimedJob>(
      `
        WITH due AS (
          SELECT id
          FROM sf_integration_outbox
          WHERE status = 'queued' AND next_attempt_at <= now()
          ORDER BY next_attempt_at ASC, created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE sf_integration_outbox o
        SET status = 'processing', locked_at = now(), attempts = o.attempts + 1, updated_at = now()
        FROM due
        WHERE o.id = due.id
        RETURNING o.id, o.organization_id, o.connection_id, o.campaign_id, o.recipient_key,
                  o.channel, o.recipient, o.subject, o.message, o.payload, o.attempts,
                  o.max_attempts, o.idempotency_key
      `,
      [limit],
    )
    await client.query("COMMIT")
    return result.rows
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

async function completeAttempt(job: ClaimedJob, result: { providerMessageId: string | null; providerStatus: string }, durationMs: number) {
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `
        UPDATE sf_integration_outbox
        SET status = 'sent', provider_message_id = $2, provider_status = $3,
            sent_at = now(), locked_at = NULL, last_error = NULL, updated_at = now()
        WHERE id = $1
      `,
      [job.id, result.providerMessageId, result.providerStatus],
    )
    await client.query(
      `
        INSERT INTO sf_integration_attempts (
          organization_id, outbox_id, attempt_number, status,
          provider_message_id, provider_status, duration_ms, created_at
        )
        VALUES ($1, $2, $3, 'sent', $4, $5, $6, now())
        ON CONFLICT (outbox_id, attempt_number) DO NOTHING
      `,
      [job.organization_id, job.id, job.attempts, result.providerMessageId, result.providerStatus, durationMs],
    )
    await client.query(
      `
        UPDATE sf_integration_connections
        SET last_success_at = now(), last_error = NULL, updated_at = now()
        WHERE id = $1 AND organization_id = $2
      `,
      [job.connection_id, job.organization_id],
    )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

async function cancelClaimedJob(job: ClaimedJob, reason: string) {
  await getPostgresPool().query(
    `
      UPDATE sf_integration_outbox
      SET status = 'cancelled', locked_at = NULL, last_error = $2, updated_at = now()
      WHERE id = $1
    `,
    [job.id, reason.slice(0, 1000)],
  )
}

async function failAttempt(job: ClaimedJob, error: unknown, durationMs: number) {
  const message = (error instanceof Error ? error.message : "Falha desconhecida no provedor.").slice(0, 1000)
  const terminal = job.attempts >= job.max_attempts
  const nextAttemptAt = new Date(Date.now() + retryDelayMinutes(job.attempts) * 60_000).toISOString()
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `
        UPDATE sf_integration_outbox
        SET status = $2, next_attempt_at = $3, locked_at = NULL,
            last_error = $4, updated_at = now()
        WHERE id = $1
      `,
      [job.id, terminal ? "failed" : "queued", nextAttemptAt, message],
    )
    await client.query(
      `
        INSERT INTO sf_integration_attempts (
          organization_id, outbox_id, attempt_number, status, error, duration_ms, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (outbox_id, attempt_number) DO NOTHING
      `,
      [job.organization_id, job.id, job.attempts, terminal ? "failed" : "retry", message, durationMs],
    )
    await client.query(
      `
        UPDATE sf_integration_connections
        SET last_error_at = now(), last_error = $3, updated_at = now()
        WHERE id = $1 AND organization_id = $2
      `,
      [job.connection_id, job.organization_id, message],
    )
    await client.query("COMMIT")
  } catch (dbError) {
    await client.query("ROLLBACK")
    throw dbError
  } finally {
    client.release()
  }
}

export async function processIntegrationQueue(input?: { limit?: number }) {
  if (!integrationEncryptionConfigured()) throw new Error("INTEGRATION_ENCRYPTION_KEY não foi configurada.")
  const limit = Math.max(1, Math.min(50, Math.trunc(Number(input?.limit || 10))))
  const jobs = await claimIntegrationJobs(limit)
  let sent = 0
  let retried = 0
  let failed = 0
  let cancelled = 0

  for (const job of jobs) {
    const started = Date.now()
    try {
      await assertDemoActionAllowed(job.organization_id, "dangerous-integration")
      const billing = await getBillingSnapshotForOrganization(job.organization_id)
      const activeBilling =
        billing.account?.status === "active" &&
        ["active", "trialing"].includes(billing.subscription?.status || "")
      if (!activeBilling || !billing.entitlements.integrations) {
        await cancelClaimedJob(job, "Envio cancelado porque a assinatura ou o entitlement de integrações não está ativo.")
        cancelled += 1
        continue
      }
      if (job.campaign_id) {
        const consent = await getPostgresPool().query<{ marketing_opt_in: boolean }>(
          `SELECT marketing_opt_in FROM sf_crm_customer_profiles WHERE organization_id = $1 AND customer_key = $2 LIMIT 1`,
          [job.organization_id, job.recipient_key],
        )
        if (!consent.rows[0]?.marketing_opt_in) {
          await cancelClaimedJob(job, "Envio cancelado porque o consentimento de marketing não está mais ativo.")
          cancelled += 1
          continue
        }
      }
      const connectionResult = await getPostgresPool().query<{
        provider: IntegrationProvider
        channel: IntegrationChannel
        status: IntegrationConnectionStatus
        settings: Record<string, unknown>
        encrypted_credentials: string
      }>(
        `SELECT provider, channel, status, settings, encrypted_credentials FROM sf_integration_connections WHERE organization_id = $1 AND id = $2 LIMIT 1`,
        [job.organization_id, job.connection_id],
      )
      const connection = connectionResult.rows[0]
      if (!connection || connection.status !== "active") throw new Error("Conexão externa está desativada ou indisponível.")
      const credentials = decryptIntegrationCredentials(connection.encrypted_credentials)
      const result = await dispatchIntegrationMessage({
        provider: connection.provider,
        channel: connection.channel,
        recipient: job.recipient,
        subject: job.subject || undefined,
        message: job.message,
        idempotencyKey: job.idempotency_key,
        credentials,
        settings: jsonObject(connection.settings),
        payload: jsonObject(job.payload),
      })
      await completeAttempt(job, result, Date.now() - started)
      sent += 1
    } catch (error) {
      await failAttempt(job, error, Date.now() - started)
      if (job.attempts >= job.max_attempts) failed += 1
      else retried += 1
    }
  }
  return { claimed: jobs.length, sent, retried, failed, cancelled }
}

function safeHexEqual(actual: string, expected: string) {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false
  const a = Buffer.from(actual, "hex")
  const b = Buffer.from(expected, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function receiveSignedIntegrationWebhook(input: {
  connectionId: string
  rawBody: string
  payload: Record<string, unknown>
  signature: string | null
  providerEventId?: string | null
  eventType?: string | null
}) {
  const connectionResult = await getPostgresPool().query<{
    organization_id: string
    provider: IntegrationProvider
    status: IntegrationConnectionStatus
    encrypted_credentials: string
  }>(
    `SELECT organization_id, provider, status, encrypted_credentials FROM sf_integration_connections WHERE id = $1 LIMIT 1`,
    [input.connectionId],
  )
  const connection = connectionResult.rows[0]
  if (!connection || connection.provider !== "webhook" || connection.status !== "active") {
    throw new Error("Webhook não encontrado.")
  }
  await assertDemoActionAllowed(connection.organization_id, "dangerous-integration")
  const credentials = decryptIntegrationCredentials(connection.encrypted_credentials)
  const secret = cleanText(credentials.signingSecret, 1000)
  if (!secret) throw new Error("Segredo do webhook não configurado.")
  const provided = String(input.signature || "").replace(/^sha256=/i, "").trim()
  const calculated = createHmac("sha256", secret).update(input.rawBody).digest("hex")
  const signatureValid = safeHexEqual(provided, calculated)
  if (!signatureValid) throw new Error("Assinatura do webhook inválida.")

  const providerEventId = cleanText(input.providerEventId, 300) || createHash("sha256").update(input.rawBody).digest("hex")
  const result = await getPostgresPool().query(
    `
      INSERT INTO sf_integration_webhook_events (
        organization_id, connection_id, provider_event_id, event_type,
        signature_valid, payload, status, received_at
      )
      VALUES ($1, $2, $3, $4, true, $5::jsonb, 'received', now())
      ON CONFLICT (connection_id, provider_event_id) DO NOTHING
    `,
    [
      connection.organization_id,
      input.connectionId,
      providerEventId,
      cleanText(input.eventType, 200) || null,
      JSON.stringify(input.payload),
    ],
  )
  return { duplicate: !result.rowCount, providerEventId }
}

export async function integrationsHealth(session: TenantAdminSession) {
  const [tables, state] = await Promise.all([
    getPostgresPool().query<{
      connections: string | null
      outbox: string | null
      attempts: string | null
      webhooks: string | null
    }>(
      `
        SELECT
          to_regclass('public.sf_integration_connections')::text AS connections,
          to_regclass('public.sf_integration_outbox')::text AS outbox,
          to_regclass('public.sf_integration_attempts')::text AS attempts,
          to_regclass('public.sf_integration_webhook_events')::text AS webhooks
      `,
    ),
    billingState(session),
  ])
  const row = tables.rows[0]
  const schemaReady = Boolean(row?.connections && row.outbox && row.attempts && row.webhooks)
  let counts = { connections: 0, activeConnections: 0, queued: 0, sent: 0, failed: 0, webhookEvents: 0 }
  if (schemaReady) {
    const result = await getPostgresPool().query<{
      connections: number
      active_connections: number
      queued: number
      sent: number
      failed: number
      webhook_events: number
    }>(
      `
        SELECT
          (SELECT COUNT(*)::int FROM sf_integration_connections WHERE organization_id = $1) AS connections,
          (SELECT COUNT(*)::int FROM sf_integration_connections WHERE organization_id = $1 AND status = 'active') AS active_connections,
          (SELECT COUNT(*)::int FROM sf_integration_outbox WHERE organization_id = $1 AND status IN ('queued', 'processing')) AS queued,
          (SELECT COUNT(*)::int FROM sf_integration_outbox WHERE organization_id = $1 AND status = 'sent') AS sent,
          (SELECT COUNT(*)::int FROM sf_integration_outbox WHERE organization_id = $1 AND status = 'failed') AS failed,
          (SELECT COUNT(*)::int FROM sf_integration_webhook_events WHERE organization_id = $1) AS webhook_events
      `,
      [session.organizationId],
    )
    counts = {
      connections: Number(result.rows[0]?.connections || 0),
      activeConnections: Number(result.rows[0]?.active_connections || 0),
      queued: Number(result.rows[0]?.queued || 0),
      sent: Number(result.rows[0]?.sent || 0),
      failed: Number(result.rows[0]?.failed || 0),
      webhookEvents: Number(result.rows[0]?.webhook_events || 0),
    }
  }

  const encryptionKeyConfigured = integrationEncryptionConfigured()
  const workerTokenConfigured = Boolean(process.env.INTEGRATION_WORKER_TOKEN?.trim())
  const webhookAllowlistConfigured = Boolean(process.env.INTEGRATION_WEBHOOK_ALLOWED_HOSTS?.trim())
  return {
    schemaReady,
    organizationLinked: Boolean(state.billing.account),
    subscriptionActive: state.subscriptionActive,
    entitlementEnabled: state.entitlementEnabled,
    crmEntitlementEnabled: state.crmEnabled,
    encryptionKeyConfigured,
    workerTokenConfigured,
    webhookAllowlistConfigured,
    dispatchReady: encryptionKeyConfigured && workerTokenConfigured && counts.activeConnections > 0,
    counts,
  }
}
