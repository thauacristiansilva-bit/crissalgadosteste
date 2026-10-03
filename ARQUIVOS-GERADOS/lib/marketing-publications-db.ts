import { getPostgresPool } from "@/lib/postgres"

export type MarketingChannel =
  | "instagram_feed"
  | "instagram_story"
  | "whatsapp_status"

export type MarketingContentType =
  | "flyer"
  | "image"
  | "video"
  | "text"

export type MarketingRecurrence =
  | "none"
  | "daily"
  | "weekly"

export type MarketingPublicationStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "published"
  | "cancelled"
  | "failed"

export type MarketingPublication = {
  id: string
  title: string
  channel: MarketingChannel
  contentType: MarketingContentType
  caption: string
  cta: string
  mediaUrl?: string
  templateKey?: string
  flyerPayload: Record<string, unknown>
  scheduledAt?: string
  recurrence: MarketingRecurrence
  recurrenceDays: number[]
  recurrenceTime?: string
  status: MarketingPublicationStatus
  active: boolean
  publishedAt?: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

export type MarketingPublicationInput = {
  title: string
  channel: MarketingChannel
  contentType?: MarketingContentType
  caption?: string
  cta?: string
  mediaUrl?: string
  templateKey?: string
  flyerPayload?: Record<string, unknown>
  scheduledAt?: string
  recurrence?: MarketingRecurrence
  recurrenceDays?: number[]
  recurrenceTime?: string
  status?: MarketingPublicationStatus
  active?: boolean
  publishedAt?: string
  lastError?: string
}

type PublicationRow = {
  id: string
  title: string
  channel: MarketingChannel
  content_type: MarketingContentType
  caption: string
  cta: string
  media_url: string | null
  template_key: string | null
  flyer_payload: Record<string, unknown> | null
  scheduled_at: Date | string | null
  recurrence: MarketingRecurrence
  recurrence_days: number[] | null
  recurrence_time: string | null
  status: MarketingPublicationStatus
  active: boolean
  published_at: Date | string | null
  last_error: string | null
  created_at: Date | string
  updated_at: Date | string
}

const channels = new Set<MarketingChannel>([
  "instagram_feed",
  "instagram_story",
  "whatsapp_status",
])

const contentTypes = new Set<MarketingContentType>([
  "flyer",
  "image",
  "video",
  "text",
])

const recurrences = new Set<MarketingRecurrence>([
  "none",
  "daily",
  "weekly",
])

const statuses = new Set<MarketingPublicationStatus>([
  "draft",
  "ready",
  "scheduled",
  "published",
  "cancelled",
  "failed",
])

function iso(value: Date | string | null) {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : undefined
}

function cleanText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max)
}

function cleanRequiredText(value: unknown, max: number, message: string) {
  const text = cleanText(value, max)
  if (!text) throw new Error(message)
  return text
}

function cleanDays(value: unknown) {
  const raw = Array.isArray(value) ? value : []
  return [...new Set(
    raw
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )].sort((a, b) => a - b)
}

function cleanTime(value: unknown) {
  const text = cleanText(value, 5)
  if (!text) return undefined
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw new Error("Horario da publicacao invalido.")
  }
  return text
}

function cleanIso(value: unknown) {
  const text = cleanText(value, 80)
  if (!text) return undefined
  const date = new Date(text)
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Data e horario da publicacao invalidos.")
  }
  return date.toISOString()
}

function cleanFlyerPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const payload = value as Record<string, unknown>
  const serialized = JSON.stringify(payload)
  if (serialized.length > 50_000) {
    throw new Error("Os dados do flyer excedem o limite permitido.")
  }
  return payload
}

function cleanInput(input: MarketingPublicationInput) {
  const title = cleanRequiredText(input.title, 120, "Informe um titulo para a publicacao.")
  const channel = channels.has(input.channel)
    ? input.channel
    : (() => { throw new Error("Canal de publicacao invalido.") })()
  const contentType = contentTypes.has(input.contentType || "flyer")
    ? (input.contentType || "flyer")
    : "flyer"
  const recurrence = recurrences.has(input.recurrence || "none")
    ? (input.recurrence || "none")
    : "none"
  const recurrenceDays = cleanDays(input.recurrenceDays)
  const recurrenceTime = cleanTime(input.recurrenceTime)
  const scheduledAt = cleanIso(input.scheduledAt)
  const status = statuses.has(input.status || "draft")
    ? (input.status || "draft")
    : "draft"

  if (recurrence === "weekly" && !recurrenceDays.length) {
    throw new Error("Selecione pelo menos um dia para a recorrencia semanal.")
  }
  if (recurrence !== "none" && !recurrenceTime) {
    throw new Error("Informe o horario da publicacao recorrente.")
  }

  return {
    title,
    channel,
    contentType,
    caption: cleanText(input.caption, 5000),
    cta: cleanText(input.cta, 160),
    mediaUrl: cleanText(input.mediaUrl, 3000) || undefined,
    templateKey: cleanText(input.templateKey, 80) || undefined,
    flyerPayload: cleanFlyerPayload(input.flyerPayload),
    scheduledAt,
    recurrence,
    recurrenceDays,
    recurrenceTime,
    status,
    active: input.active !== false,
    publishedAt: cleanIso(input.publishedAt),
    lastError: cleanText(input.lastError, 1000) || undefined,
  }
}

function mapRow(row: PublicationRow): MarketingPublication {
  return {
    id: row.id,
    title: row.title,
    channel: row.channel,
    contentType: row.content_type,
    caption: row.caption || "",
    cta: row.cta || "",
    ...(row.media_url ? { mediaUrl: row.media_url } : {}),
    ...(row.template_key ? { templateKey: row.template_key } : {}),
    flyerPayload: row.flyer_payload || {},
    ...(iso(row.scheduled_at) ? { scheduledAt: iso(row.scheduled_at) } : {}),
    recurrence: row.recurrence,
    recurrenceDays: cleanDays(row.recurrence_days),
    ...(row.recurrence_time ? { recurrenceTime: String(row.recurrence_time).slice(0, 5) } : {}),
    status: row.status,
    active: Boolean(row.active),
    ...(iso(row.published_at) ? { publishedAt: iso(row.published_at) } : {}),
    ...(row.last_error ? { lastError: row.last_error } : {}),
    createdAt: iso(row.created_at) || new Date().toISOString(),
    updatedAt: iso(row.updated_at) || new Date().toISOString(),
  }
}

export async function isMarketingPublicationsReady() {
  const result = await getPostgresPool().query<{ ready: boolean }>(`
    SELECT to_regclass('public.sf_marketing_publications') IS NOT NULL AS ready
  `)
  return Boolean(result.rows[0]?.ready)
}

export async function getTenantMarketingPublications(
  organizationId: string,
): Promise<MarketingPublication[]> {
  try {
    const result = await getPostgresPool().query<PublicationRow>(`
      SELECT
        id,
        title,
        channel,
        content_type,
        caption,
        cta,
        media_url,
        template_key,
        flyer_payload,
        scheduled_at,
        recurrence,
        recurrence_days,
        recurrence_time::text,
        status,
        active,
        published_at,
        last_error,
        created_at,
        updated_at
      FROM sf_marketing_publications
      WHERE organization_id = $1
      ORDER BY
        active DESC,
        COALESCE(scheduled_at, '9999-12-31'::timestamptz) ASC,
        updated_at DESC
      LIMIT 500
    `, [organizationId])
    return result.rows.map(mapRow)
  } catch (error) {
    if ((error as { code?: string })?.code === "42P01") return []
    throw error
  }
}

export async function createTenantMarketingPublication(
  organizationId: string,
  userId: string,
  input: MarketingPublicationInput,
) {
  const clean = cleanInput(input)
  const result = await getPostgresPool().query<{ id: string }>(`
    INSERT INTO sf_marketing_publications (
      organization_id,
      created_by,
      title,
      channel,
      content_type,
      caption,
      cta,
      media_url,
      template_key,
      flyer_payload,
      scheduled_at,
      recurrence,
      recurrence_days,
      recurrence_time,
      status,
      active,
      published_at,
      last_error
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb,
      $11, $12, $13::smallint[], $14::time, $15, $16, $17, $18
    )
    RETURNING id
  `, [
    organizationId,
    userId || null,
    clean.title,
    clean.channel,
    clean.contentType,
    clean.caption,
    clean.cta,
    clean.mediaUrl || null,
    clean.templateKey || null,
    JSON.stringify(clean.flyerPayload),
    clean.scheduledAt || null,
    clean.recurrence,
    clean.recurrenceDays,
    clean.recurrenceTime || null,
    clean.status,
    clean.active,
    clean.publishedAt || null,
    clean.lastError || null,
  ])

  const items = await getTenantMarketingPublications(organizationId)
  return items.find((item) => item.id === result.rows[0]?.id) || null
}

export async function updateTenantMarketingPublication(
  organizationId: string,
  id: string,
  patch: Partial<MarketingPublicationInput>,
) {
  const currentResult = await getPostgresPool().query<PublicationRow>(`
    SELECT
      id,
      title,
      channel,
      content_type,
      caption,
      cta,
      media_url,
      template_key,
      flyer_payload,
      scheduled_at,
      recurrence,
      recurrence_days,
      recurrence_time::text,
      status,
      active,
      published_at,
      last_error,
      created_at,
      updated_at
    FROM sf_marketing_publications
    WHERE organization_id = $1 AND id = $2
    LIMIT 1
  `, [organizationId, id])

  const currentRow = currentResult.rows[0]
  if (!currentRow) return null
  const current = mapRow(currentRow)

  const clean = cleanInput({
    title: patch.title ?? current.title,
    channel: patch.channel ?? current.channel,
    contentType: patch.contentType ?? current.contentType,
    caption: patch.caption ?? current.caption,
    cta: patch.cta ?? current.cta,
    mediaUrl: patch.mediaUrl !== undefined ? patch.mediaUrl : current.mediaUrl,
    templateKey: patch.templateKey !== undefined ? patch.templateKey : current.templateKey,
    flyerPayload: patch.flyerPayload ?? current.flyerPayload,
    scheduledAt: patch.scheduledAt !== undefined ? patch.scheduledAt : current.scheduledAt,
    recurrence: patch.recurrence ?? current.recurrence,
    recurrenceDays: patch.recurrenceDays ?? current.recurrenceDays,
    recurrenceTime: patch.recurrenceTime !== undefined ? patch.recurrenceTime : current.recurrenceTime,
    status: patch.status ?? current.status,
    active: patch.active ?? current.active,
    publishedAt: patch.publishedAt !== undefined ? patch.publishedAt : current.publishedAt,
    lastError: patch.lastError !== undefined ? patch.lastError : current.lastError,
  })

  await getPostgresPool().query(`
    UPDATE sf_marketing_publications
    SET
      title = $3,
      channel = $4,
      content_type = $5,
      caption = $6,
      cta = $7,
      media_url = $8,
      template_key = $9,
      flyer_payload = $10::jsonb,
      scheduled_at = $11,
      recurrence = $12,
      recurrence_days = $13::smallint[],
      recurrence_time = $14::time,
      status = $15,
      active = $16,
      published_at = $17,
      last_error = $18,
      updated_at = now()
    WHERE organization_id = $1 AND id = $2
  `, [
    organizationId,
    id,
    clean.title,
    clean.channel,
    clean.contentType,
    clean.caption,
    clean.cta,
    clean.mediaUrl || null,
    clean.templateKey || null,
    JSON.stringify(clean.flyerPayload),
    clean.scheduledAt || null,
    clean.recurrence,
    clean.recurrenceDays,
    clean.recurrenceTime || null,
    clean.status,
    clean.active,
    clean.publishedAt || null,
    clean.lastError || null,
  ])

  const items = await getTenantMarketingPublications(organizationId)
  return items.find((item) => item.id === id) || null
}
