import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"
import {
  enterRlsUserContext,
  enterTenantRlsContext,
  runWithRlsBypass,
  runWithRlsUserContext,
  runWithTenantRlsScope,
} from "@/lib/rls-context"

export type AuthTokenPurpose =
  | "invite"
  | "password_reset"

export type CreatedAuthToken = {
  token: string
  expiresAt: string
}

export function hashOpaqueToken(
  token: string,
) {
  return createHash("sha256")
    .update(token)
    .digest("hex")
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url")
}

export async function revokeOutstandingAuthTokens(
  userId: string,
  purpose?: AuthTokenPurpose,
  organizationId?: string | null,
) {
  const params: unknown[] = [userId]
  const conditions = [
    "user_id = $1",
    "used_at IS NULL",
  ]

  if (purpose) {
    params.push(purpose)
    conditions.push(
      `purpose = $${params.length}`,
    )
  }

  if (organizationId !== undefined) {
    params.push(organizationId)
    conditions.push(
      organizationId === null
        ? `organization_id IS NULL`
        : `organization_id = $${params.length}`,
    )
  }

  await runWithRlsUserContext(userId, () =>
    getPostgresPool().query(
      `
        UPDATE sf_auth_tokens
        SET used_at = COALESCE(used_at, now())
        WHERE ${conditions.join(" AND ")}
      `,
      params,
    ),
  )
}

export async function createAuthToken(
  input: {
    userId: string
    organizationId?: string | null
    purpose: AuthTokenPurpose
    createdByUserId?: string | null
    expiresInMinutes: number
    metadata?: Record<string, unknown>
  },
): Promise<CreatedAuthToken> {
  const token = createOpaqueToken()
  const tokenHash = hashOpaqueToken(token)

  const expiresAt = new Date(
    Date.now() +
      Math.max(
        5,
        input.expiresInMinutes,
      ) *
        60 *
        1000,
  )

  const createToken = () =>
    getPostgresPool().query(
      `
        INSERT INTO sf_auth_tokens (
          id,
          user_id,
          organization_id,
          purpose,
          token_hash,
          expires_at,
          created_by_user_id,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::jsonb
        )
      `,
      [
        randomUUID(),
        input.userId,
        input.organizationId ?? null,
        input.purpose,
        tokenHash,
        expiresAt,
        input.createdByUserId ?? null,
        JSON.stringify(
          input.metadata || {},
        ),
      ],
    )

  if (input.organizationId) {
    await runWithTenantRlsScope(
      [input.organizationId],
      input.userId,
      createToken,
      "bootstrap-user",
    )
  } else {
    await runWithRlsUserContext(input.userId, createToken)
  }

  return {
    token,
    expiresAt:
      expiresAt.toISOString(),
  }
}

export type ValidAuthToken = {
  id: string
  userId: string
  organizationId: string | null
  purpose: AuthTokenPurpose
  metadata: Record<string, unknown>
  expiresAt: string
}

export async function getValidAuthToken(
  token: string,
  purpose: AuthTokenPurpose,
): Promise<ValidAuthToken | null> {
  const tokenHash = hashOpaqueToken(token)

  const result =
    await runWithRlsBypass(() =>
      getPostgresPool().query<{
        id: string
        user_id: string
        organization_id: string | null
        purpose: AuthTokenPurpose
        metadata: Record<string, unknown>
        expires_at: Date | string
      }>(
        `
          SELECT
            id,
            user_id,
            organization_id,
            purpose,
            metadata,
            expires_at
          FROM sf_auth_tokens
          WHERE token_hash = $1
            AND purpose = $2
            AND used_at IS NULL
            AND expires_at > now()
          LIMIT 1
        `,
        [tokenHash, purpose],
      ),
    )

  const row = result.rows[0]
  if (!row) return null

  if (row.organization_id) {
    enterTenantRlsContext(
      row.organization_id,
      row.user_id,
      "bootstrap-user",
    )
  } else {
    enterRlsUserContext(row.user_id)
  }

  return {
    id: row.id,
    userId: row.user_id,
    organizationId:
      row.organization_id,
    purpose: row.purpose,
    metadata:
      row.metadata &&
      typeof row.metadata === "object"
        ? row.metadata
        : {},
    expiresAt:
      row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : new Date(
            row.expires_at,
          ).toISOString(),
  }
}

export async function consumeAuthToken(
  id: string,
) {
  const result =
    await runWithRlsBypass(() =>
      getPostgresPool().query(
        `
          UPDATE sf_auth_tokens
          SET used_at = now()
          WHERE id = $1
            AND used_at IS NULL
            AND expires_at > now()
          RETURNING id
        `,
        [id],
      ),
    )

  return Boolean(result.rowCount)
}
