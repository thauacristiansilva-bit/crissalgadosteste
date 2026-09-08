import { enterRlsUserContext } from "@/lib/rls-context"
import {
  createHash,
  randomUUID,
} from "node:crypto"
import {
  ADMIN_SESSION_IDLE_SECONDS,
} from "@/lib/auth"
import { getPostgresPool } from "@/lib/postgres"
import {
  requestIp,
} from "@/lib/security/request-security"
import type {
  TwoFactorAuthSource,
} from "@/lib/security/two-factor-challenge"

export type AdminSessionAuthSource =
  | TwoFactorAuthSource
  | "commercial"
  | "demo"

const MAX_ACTIVE_SESSIONS_PER_USER = 20

type ActiveSessionRow = {
  id: string
  organization_id: string
  organization_name: string
  auth_source: AdminSessionAuthSource
  superadmin_authorized: boolean
  device_label: string
  created_at: Date | string
  last_seen_at: Date | string
  expires_at: Date | string
}

export type AdminSessionSummary = {
  id: string
  organizationId: string
  organizationName: string
  authSource: AdminSessionAuthSource
  superadminAuthorized: boolean
  deviceLabel: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}

function hashSignal(
  namespace: string,
  value: string,
) {
  if (!value.trim()) {
    return null
  }

  return createHash("sha256")
    .update(
      `saborflow:admin-session:${namespace}:v1:${value}`,
    )
    .digest("hex")
}

function browserName(
  userAgent: string,
) {
  if (/Edg\//i.test(userAgent)) return "Microsoft Edge"
  if (/OPR\//i.test(userAgent)) return "Opera"
  if (/Firefox\//i.test(userAgent)) return "Firefox"
  if (/Chrome\//i.test(userAgent) || /CriOS\//i.test(userAgent)) {
    return "Google Chrome"
  }
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) {
    return "Safari"
  }
  return "Navegador"
}

function operatingSystemName(
  userAgent: string,
) {
  if (/Windows/i.test(userAgent)) return "Windows"
  if (/iPhone/i.test(userAgent)) return "iPhone"
  if (/iPad/i.test(userAgent)) return "iPad"
  if (/Android/i.test(userAgent)) return "Android"
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS"
  if (/Linux/i.test(userAgent)) return "Linux"
  return "dispositivo desconhecido"
}

function deviceLabel(
  userAgent: string,
) {
  if (!userAgent.trim()) {
    return "Dispositivo nÃƒÂ£o identificado"
  }

  return `${browserName(userAgent)} no ${operatingSystemName(userAgent)}`
}

function iso(
  value: Date | string,
) {
  return new Date(value).toISOString()
}

export async function createAdminSessionRecord(
  input: {
    userId: string
    organizationId: string
    sessionVersion: number
    authSource: AdminSessionAuthSource
    superadminAuthorized: boolean
    request: Request
    maxAgeSeconds?: number
  },
) {
  enterRlsUserContext(input.userId)

  const id = randomUUID()
  const maxAgeSeconds =
    Math.max(
      60,
      Math.min(
        ADMIN_SESSION_IDLE_SECONDS,
        Math.floor(
          input.maxAgeSeconds ??
            ADMIN_SESSION_IDLE_SECONDS,
        ),
      ),
    )
  const userAgent =
    input.request.headers.get(
      "user-agent",
    ) || ""
  const ip =
    requestIp(input.request)

  const client =
    await getPostgresPool().connect()

  try {
    await client.query("BEGIN")

    await client.query(
      `
        INSERT INTO sf_admin_sessions (
          id,
          user_id,
          organization_id,
          session_version,
          auth_source,
          superadmin_authorized,
          device_label,
          user_agent_hash,
          ip_hash,
          created_at,
          last_seen_at,
          expires_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          now(),
          now(),
          now() +
            ($10::integer *
              interval '1 second')
        )
      `,
      [
        id,
        input.userId,
        input.organizationId,
        input.sessionVersion,
        input.authSource,
        input.superadminAuthorized,
        deviceLabel(userAgent),
        hashSignal(
          "ua",
          userAgent,
        ),
        hashSignal(
          "ip",
          ip,
        ),
        maxAgeSeconds,
      ],
    )

    await client.query(
      `
        UPDATE sf_admin_sessions
        SET
          revoked_at = now(),
          revoked_reason =
            'active_session_limit'
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND id IN (
            SELECT id
            FROM sf_admin_sessions
            WHERE user_id = $1
              AND revoked_at IS NULL
            ORDER BY
              last_seen_at DESC,
              created_at DESC
            OFFSET $2
          )
      `,
      [
        input.userId,
        MAX_ACTIVE_SESSIONS_PER_USER,
      ],
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  return {
    id,
  }
}

export async function validateAndTouchAdminSession(
  input: {
    sessionId: string
    userId: string
    organizationId: string
    sessionVersion: number
  },
) {
  enterRlsUserContext(input.userId)

  const result =
    await getPostgresPool()
      .query<{ id: string }>(
        `
          UPDATE sf_admin_sessions AS s
          SET
            last_seen_at = now(),
            expires_at =
              now() +
              ($5::integer *
                interval '1 second')
          FROM sf_users AS u
          WHERE s.id = $1
            AND s.user_id = $2
            AND s.organization_id = $3
            AND s.session_version = $4
            AND s.revoked_at IS NULL
            AND s.expires_at > now()
            AND u.id = s.user_id
            AND u.status = 'active'
            AND u.session_version =
              s.session_version
          RETURNING s.id
        `,
        [
          input.sessionId,
          input.userId,
          input.organizationId,
          input.sessionVersion,
          ADMIN_SESSION_IDLE_SECONDS,
        ],
      )

  return Boolean(
    result.rowCount,
  )
}

export async function listAdminSessions(
  userId: string,
  currentSessionId: string,
) {
  enterRlsUserContext(userId)

  const result =
    await getPostgresPool()
      .query<ActiveSessionRow>(
        `
          SELECT
            s.id,
            s.organization_id,
            o.trade_name AS organization_name,
            s.auth_source,
            s.superadmin_authorized,
            s.device_label,
            s.created_at,
            s.last_seen_at,
            s.expires_at
          FROM sf_admin_sessions AS s
          INNER JOIN sf_users AS u
            ON u.id = s.user_id
          INNER JOIN sf_organizations AS o
            ON o.id = s.organization_id
          WHERE s.user_id = $1
            AND s.revoked_at IS NULL
            AND s.expires_at > now()
            AND s.session_version =
              u.session_version
            AND u.status = 'active'
          ORDER BY
            (s.id = $2) DESC,
            s.last_seen_at DESC,
            s.created_at DESC
        `,
        [
          userId,
          currentSessionId,
        ],
      )

  return result.rows.map(
    (
      row,
    ): AdminSessionSummary => ({
      id: row.id,
      organizationId:
        row.organization_id,
      organizationName:
        row.organization_name,
      authSource:
        row.auth_source,
      superadminAuthorized:
        Boolean(
          row.superadmin_authorized,
        ),
      deviceLabel:
        row.device_label,
      createdAt:
        iso(row.created_at),
      lastSeenAt:
        iso(row.last_seen_at),
      expiresAt:
        iso(row.expires_at),
      current:
        row.id ===
        currentSessionId,
    }),
  )
}


export async function moveAdminSessionToOrganization(
  input: {
    sessionId: string
    userId: string
    organizationId: string
    sessionVersion: number
  },
) {
  enterRlsUserContext(input.userId)

  const result =
    await getPostgresPool()
      .query<{ id: string }>(
        `
          UPDATE sf_admin_sessions AS s
          SET
            organization_id = $3,
            last_seen_at = now(),
            expires_at =
              now() +
              ($5::integer *
                interval '1 second')
          FROM sf_users AS u
          WHERE s.id = $1
            AND s.user_id = $2
            AND s.session_version = $4
            AND s.revoked_at IS NULL
            AND s.expires_at > now()
            AND u.id = s.user_id
            AND u.status = 'active'
            AND u.session_version =
              s.session_version
          RETURNING s.id
        `,
        [
          input.sessionId,
          input.userId,
          input.organizationId,
          input.sessionVersion,
          ADMIN_SESSION_IDLE_SECONDS,
        ],
      )

  return Boolean(
    result.rowCount,
  )
}

export async function revokeAdminSession(
  input: {
    sessionId: string
    userId: string
    reason:
      | "logout"
      | "user_revoked"
      | "revoke_others"
      | "security_reset"
  },
) {
  enterRlsUserContext(input.userId)

  const result =
    await getPostgresPool()
      .query<{ id: string }>(
        `
          UPDATE sf_admin_sessions
          SET
            revoked_at =
              COALESCE(
                revoked_at,
                now()
              ),
            revoked_reason =
              COALESCE(
                revoked_reason,
                $3
              )
          WHERE id = $1
            AND user_id = $2
          RETURNING id
        `,
        [
          input.sessionId,
          input.userId,
          input.reason,
        ],
      )

  return Boolean(
    result.rowCount,
  )
}

export async function revokeOtherAdminSessions(
  userId: string,
  currentSessionId: string,
) {
  enterRlsUserContext(userId)

  const result =
    await getPostgresPool()
      .query(
        `
          UPDATE sf_admin_sessions
          SET
            revoked_at = now(),
            revoked_reason =
              'revoke_others'
          WHERE user_id = $1
            AND id <> $2
            AND revoked_at IS NULL
        `,
        [
          userId,
          currentSessionId,
        ],
      )

  return result.rowCount || 0
}

export async function revokeAllAdminSessionsForUser(
  userId: string,
) {
  enterRlsUserContext(userId)

  const result =
    await getPostgresPool()
      .query(
        `
          UPDATE sf_admin_sessions
          SET
            revoked_at = now(),
            revoked_reason =
              'security_reset'
          WHERE user_id = $1
            AND revoked_at IS NULL
        `,
        [userId],
      )

  return result.rowCount || 0
}
