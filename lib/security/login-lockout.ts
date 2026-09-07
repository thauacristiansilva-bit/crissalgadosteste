import { createHash } from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"

type LoginSubject = {
  subjectKey: string
  userId: string | null
}

type LoginLockoutRow = {
  failure_count: number
  locked_until: Date | string | null
}

export type PersistentLoginLockState = {
  locked: boolean
  failureCount: number
  retryAfterSeconds: number
}

function normalizeIdentifier(
  identifier: string,
) {
  const trimmed =
    identifier.trim()

  if (trimmed.includes("@")) {
    return {
      type: "email" as const,
      value:
        trimmed.toLowerCase(),
    }
  }

  return {
    type: "cpf" as const,
    value:
      trimmed.replace(/\D/g, ""),
  }
}

function unknownSubjectKey(
  type: "email" | "cpf",
  value: string,
) {
  const digest =
    createHash("sha256")
      .update(
        `saborflow:login-lockout:v1:${type}:${value}`,
      )
      .digest("hex")

  return `unknown:${digest}`
}

async function resolveLoginSubject(
  identifier: string,
): Promise<LoginSubject> {
  const normalized =
    normalizeIdentifier(
      identifier,
    )

  if (
    normalized.type === "cpf" &&
    normalized.value.length !== 11
  ) {
    return {
      subjectKey:
        unknownSubjectKey(
          normalized.type,
          normalized.value,
        ),
      userId: null,
    }
  }

  const result =
    await getPostgresPool()
      .query<{ id: string }>(
        `
          SELECT id
          FROM sf_users
          WHERE (
            $2 = 'email'
            AND lower(email) =
              lower($1)
          )
          OR (
            $2 = 'cpf'
            AND regexp_replace(
              COALESCE(cpf, ''),
              '[^0-9]',
              '',
              'g'
            ) = $1
          )
          LIMIT 1
        `,
        [
          normalized.value,
          normalized.type,
        ],
      )

  const userId =
    result.rows[0]?.id || null

  if (userId) {
    return {
      subjectKey:
        `user:${userId}`,
      userId,
    }
  }

  return {
    subjectKey:
      unknownSubjectKey(
        normalized.type,
        normalized.value,
      ),
    userId: null,
  }
}

function retryAfterSeconds(
  lockedUntil:
    | Date
    | string
    | null,
) {
  if (!lockedUntil) {
    return 0
  }

  const expiresAt =
    new Date(
      lockedUntil,
    ).getTime()

  if (
    !Number.isFinite(
      expiresAt,
    )
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.ceil(
      (expiresAt -
        Date.now()) /
        1000,
    ),
  )
}

function lockSecondsForFailures(
  failureCount: number,
) {
  if (failureCount < 5) {
    return 0
  }

  if (failureCount === 5) {
    return 30
  }

  if (failureCount === 6) {
    return 60
  }

  if (failureCount === 7) {
    return 5 * 60
  }

  if (failureCount === 8) {
    return 15 * 60
  }

  if (failureCount === 9) {
    return 30 * 60
  }

  return 60 * 60
}

export async function checkPersistentLoginLock(
  identifier: string,
): Promise<PersistentLoginLockState> {
  const subject =
    await resolveLoginSubject(
      identifier,
    )

  const result =
    await getPostgresPool()
      .query<LoginLockoutRow>(
        `
          SELECT
            failure_count,
            locked_until
          FROM sf_auth_login_lockouts
          WHERE subject_key = $1
          LIMIT 1
        `,
        [subject.subjectKey],
      )

  const row =
    result.rows[0]

  if (!row) {
    return {
      locked: false,
      failureCount: 0,
      retryAfterSeconds: 0,
    }
  }

  const retry =
    retryAfterSeconds(
      row.locked_until,
    )

  return {
    locked: retry > 0,
    failureCount:
      Number(
        row.failure_count,
      ) || 0,
    retryAfterSeconds:
      retry,
  }
}

export async function registerPersistentLoginFailure(
  identifier: string,
): Promise<PersistentLoginLockState> {
  const subject =
    await resolveLoginSubject(
      identifier,
    )

  const result =
    await getPostgresPool()
      .query<{
        failure_count: number
      }>(
        `
          INSERT INTO sf_auth_login_lockouts (
            subject_key,
            user_id,
            failure_count,
            locked_until,
            last_failed_at,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            1,
            NULL,
            now(),
            now(),
            now()
          )
          ON CONFLICT (subject_key)
          DO UPDATE
          SET
            user_id = COALESCE(
              EXCLUDED.user_id,
              sf_auth_login_lockouts.user_id
            ),
            failure_count = CASE
              WHEN
                sf_auth_login_lockouts.last_failed_at
                  IS NULL
                OR sf_auth_login_lockouts.last_failed_at <
                  now() - interval '24 hours'
              THEN 1
              ELSE
                sf_auth_login_lockouts.failure_count + 1
            END,
            last_failed_at = now(),
            updated_at = now()
          RETURNING failure_count
        `,
        [
          subject.subjectKey,
          subject.userId,
        ],
      )

  const failureCount =
    Number(
      result.rows[0]
        ?.failure_count,
    ) || 1

  const lockSeconds =
    lockSecondsForFailures(
      failureCount,
    )

  if (lockSeconds <= 0) {
    return {
      locked: false,
      failureCount,
      retryAfterSeconds: 0,
    }
  }

  const locked =
    await getPostgresPool()
      .query<{
        locked_until:
          | Date
          | string
      }>(
        `
          UPDATE sf_auth_login_lockouts
          SET
            locked_until =
              GREATEST(
                COALESCE(
                  locked_until,
                  now()
                ),
                now() +
                  ($2::integer *
                    interval '1 second')
              ),
            updated_at = now()
          WHERE subject_key = $1
          RETURNING locked_until
        `,
        [
          subject.subjectKey,
          lockSeconds,
        ],
      )

  const retry =
    retryAfterSeconds(
      locked.rows[0]
        ?.locked_until || null,
    )

  return {
    locked: retry > 0,
    failureCount,
    retryAfterSeconds:
      retry ||
      lockSeconds,
  }
}

export async function clearPersistentLoginFailures(
  identifier: string,
  userId?: string,
) {
  const subject =
    await resolveLoginSubject(
      identifier,
    )

  await getPostgresPool()
    .query(
      `
        DELETE FROM sf_auth_login_lockouts
        WHERE subject_key = $1
          OR (
            $2::uuid IS NOT NULL
            AND user_id = $2::uuid
          )
      `,
      [
        subject.subjectKey,
        userId || null,
      ],
    )
}

export async function clearPersistentLoginFailuresForUser(
  userId: string,
) {
  await getPostgresPool()
    .query(
      `
        DELETE FROM sf_auth_login_lockouts
        WHERE user_id = $1
          OR subject_key = $2
      `,
      [
        userId,
        `user:${userId}`,
      ],
    )
}
