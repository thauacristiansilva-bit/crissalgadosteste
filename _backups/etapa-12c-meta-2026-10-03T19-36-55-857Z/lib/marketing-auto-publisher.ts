import { randomUUID } from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"
import { getMetaInstagramConnection } from "@/lib/meta-instagram-db"
import {
  absoluteMarketingMediaUrl,
  createInstagramImageContainer,
  publishInstagramContainer,
  waitInstagramContainer,
} from "@/lib/meta-instagram"

type ClaimedPublication = {
  id: string
  organization_id: string
  title: string
  channel: "instagram_feed" | "instagram_story" | "whatsapp_status"
  content_type: string
  caption: string
  media_url: string | null
  scheduled_at: Date | string | null
  recurrence: "none" | "daily" | "weekly"
  recurrence_days: number[] | null
  recurrence_time: string | null
  consecutive_failures: number
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

function fixedOffsetMinutes() {
  return envNumber("MARKETING_TIMEZONE_OFFSET_MINUTES", -180)
}

function nextRecurringAt(
  publication: ClaimedPublication,
  now = new Date(),
) {
  if (publication.recurrence === "none") return null

  const offset = fixedOffsetMinutes()
  const shiftedNow = new Date(now.getTime() + offset * 60_000)
  const [hour, minute] = String(publication.recurrence_time || "09:00")
    .split(":")
    .map(Number)

  function localWallToUtc(localWall: Date) {
    return new Date(localWall.getTime() - offset * 60_000)
  }

  if (publication.recurrence === "daily") {
    const candidate = new Date(Date.UTC(
      shiftedNow.getUTCFullYear(),
      shiftedNow.getUTCMonth(),
      shiftedNow.getUTCDate(),
      hour || 0,
      minute || 0,
      0,
      0,
    ))
    if (candidate.getTime() <= shiftedNow.getTime()) {
      candidate.setUTCDate(candidate.getUTCDate() + 1)
    }
    return localWallToUtc(candidate)
  }

  const days = Array.isArray(publication.recurrence_days)
    ? publication.recurrence_days
        .map(Number)
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : []

  if (!days.length) return null

  for (let delta = 0; delta <= 7; delta += 1) {
    const candidate = new Date(Date.UTC(
      shiftedNow.getUTCFullYear(),
      shiftedNow.getUTCMonth(),
      shiftedNow.getUTCDate() + delta,
      hour || 0,
      minute || 0,
      0,
      0,
    ))
    if (
      days.includes(candidate.getUTCDay()) &&
      candidate.getTime() > shiftedNow.getTime()
    ) {
      return localWallToUtc(candidate)
    }
  }

  return null
}

async function claimDuePublications(limit: number) {
  const pool = getPostgresPool()
  const key = randomUUID()

  const result = await pool.query<ClaimedPublication>(`
    WITH due AS (
      SELECT id
      FROM sf_marketing_publications
      WHERE
        active = true
        AND status = 'scheduled'
        AND channel IN ('instagram_feed', 'instagram_story')
        AND scheduled_at IS NOT NULL
        AND COALESCE(next_attempt_at, scheduled_at) <= now()
        AND (
          processing_until IS NULL
          OR processing_until < now()
        )
      ORDER BY COALESCE(next_attempt_at, scheduled_at) ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE sf_marketing_publications p
    SET
      processing_key = $2::uuid,
      processing_until = now() + interval '4 minutes',
      publish_attempts = COALESCE(p.publish_attempts, 0) + 1,
      last_attempt_at = now(),
      updated_at = now()
    FROM due
    WHERE p.id = due.id
    RETURNING
      p.id,
      p.organization_id,
      p.title,
      p.channel,
      p.content_type,
      p.caption,
      p.media_url,
      p.scheduled_at,
      p.recurrence,
      p.recurrence_days,
      p.recurrence_time::text,
      COALESCE(p.consecutive_failures, 0) AS consecutive_failures
  `, [Math.max(1, Math.min(limit, 50)), key])

  return result.rows
}

async function markSuccess(
  publication: ClaimedPublication,
  containerId: string,
  remoteMediaId: string,
) {
  const next = nextRecurringAt(publication)
  const recurring = Boolean(next)

  await getPostgresPool().query(`
    UPDATE sf_marketing_publications
    SET
      remote_container_id = $2,
      remote_media_id = $3,
      published_at = now(),
      last_error = NULL,
      consecutive_failures = 0,
      processing_key = NULL,
      processing_until = NULL,
      next_attempt_at = NULL,
      scheduled_at = CASE WHEN $4::timestamptz IS NULL THEN scheduled_at ELSE $4::timestamptz END,
      status = CASE WHEN $5 THEN 'scheduled' ELSE 'published' END,
      active = CASE WHEN $5 THEN true ELSE false END,
      updated_at = now()
    WHERE id = $1
  `, [
    publication.id,
    containerId,
    remoteMediaId,
    next ? next.toISOString() : null,
    recurring,
  ])
}

async function markFailure(
  publication: ClaimedPublication,
  message: string,
) {
  const failures = Number(publication.consecutive_failures || 0) + 1
  const terminal = failures >= 5

  await getPostgresPool().query(`
    UPDATE sf_marketing_publications
    SET
      last_error = $2,
      consecutive_failures = $3,
      processing_key = NULL,
      processing_until = NULL,
      next_attempt_at = CASE
        WHEN $4 THEN NULL
        ELSE now() + interval '10 minutes'
      END,
      status = CASE WHEN $4 THEN 'failed' ELSE 'scheduled' END,
      active = CASE WHEN $4 THEN false ELSE true END,
      updated_at = now()
    WHERE id = $1
  `, [
    publication.id,
    String(message || "Falha ao publicar.").slice(0, 1000),
    failures,
    terminal,
  ])
}

export async function publishOneMarketingPublication(
  publication: ClaimedPublication,
) {
  if (publication.channel === "whatsapp_status") {
    throw new Error(
      "Status do WhatsApp permanece como publicacao assistida; nao ha envio automatico oficial configurado.",
    )
  }

  if (!publication.media_url) {
    throw new Error("A publicacao nao possui arte.")
  }

  if (publication.content_type === "video") {
    throw new Error(
      "A automacao desta etapa publica imagens. Reels em video entram na proxima extensao.",
    )
  }

  const connection = await getMetaInstagramConnection(
    publication.organization_id,
  )
  if (!connection?.active || !connection.accessToken) {
    throw new Error("Instagram nao conectado para esta empresa.")
  }

  if (
    connection.tokenExpiresAt &&
    new Date(connection.tokenExpiresAt).getTime() <= Date.now()
  ) {
    throw new Error("A conexao do Instagram expirou. Reconecte a conta.")
  }

  const imageUrl = absoluteMarketingMediaUrl(publication.media_url)
  const containerId = await createInstagramImageContainer({
    igUserId: connection.instagramUserId,
    accessToken: connection.accessToken,
    imageUrl,
    caption: publication.caption,
    story: publication.channel === "instagram_story",
  })

  await waitInstagramContainer(
    containerId,
    connection.accessToken,
  )

  const remoteMediaId = await publishInstagramContainer({
    igUserId: connection.instagramUserId,
    accessToken: connection.accessToken,
    containerId,
  })

  await markSuccess(
    publication,
    containerId,
    remoteMediaId,
  )

  return {
    publicationId: publication.id,
    remoteMediaId,
  }
}

export async function runDueMarketingPublications(limit = 15) {
  const claimed = await claimDuePublications(limit)

  let published = 0
  let failed = 0
  const errors: Array<{ id: string; error: string }> = []

  for (const publication of claimed) {
    try {
      await publishOneMarketingPublication(publication)
      published += 1
    } catch (error) {
      failed += 1
      const message =
        error instanceof Error
          ? error.message
          : "Falha desconhecida na publicacao."
      errors.push({ id: publication.id, error: message })
      await markFailure(publication, message)
    }
  }

  return {
    claimed: claimed.length,
    published,
    failed,
    errors,
  }
}
