import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"
import { consumeAuthToken, getValidAuthToken, revokeOutstandingAuthTokens } from "@/lib/security-tokens"

const PREFIX = "scrypt$v1"
const MIN_ADMIN_PASSWORD_LENGTH = 12
const DUMMY_PASSWORD_HASH = `${PREFIX}$saborflow-auth-dummy$${scryptSync(
  "__saborflow_invalid_password__",
  "saborflow-auth-dummy",
  32,
).toString("hex")}`

type AdminUserCredentialRow = {
  id: string
  name: string
  email: string
  password_hash: string | null
  status: string
}

export type AuthenticatedAdminUser = {
  id: string
  name: string
  email: string
}

export function hashAdminPassword(password: string) {
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      "A senha administrativa deve ter pelo menos 12 caracteres.",
    )
  }

  const salt = randomBytes(16).toString("hex")
  const digest = scryptSync(
    password,
    salt,
    32,
  ).toString("hex")

  return `${PREFIX}$${salt}$${digest}`
}

export function verifyAdminPassword(
  password: string,
  stored: string,
) {
  const [algorithm, version, salt, digest] =
    stored.split("$")

  if (
    algorithm !== "scrypt" ||
    version !== "v1" ||
    !salt ||
    !digest
  ) {
    return false
  }

  try {
    const actual = scryptSync(
      password,
      salt,
      32,
    )
    const expected = Buffer.from(
      digest,
      "hex",
    )

    return (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    )
  } catch {
    return false
  }
}

export async function getAdminUserCredentialState(
  email: string,
) {
  const result =
    await getPostgresPool().query<AdminUserCredentialRow>(
      `
        SELECT
          id,
          name,
          email,
          password_hash,
          status
        FROM sf_users
        WHERE lower(email) = lower($1)
        LIMIT 1
      `,
      [email.trim()],
    )

  const row = result.rows[0]

  return row
    ? {
        userId: row.id,
        name: row.name,
        email: row.email,
        active: row.status === "active",
        passwordReady:
          Boolean(row.password_hash),
      }
    : null
}

export async function authenticateAdminUser(
  email: string,
  password: string,
): Promise<AuthenticatedAdminUser | null> {
  const result =
    await getPostgresPool().query<AdminUserCredentialRow>(
      `
        SELECT
          id,
          name,
          email,
          password_hash,
          status
        FROM sf_users
        WHERE lower(email) = lower($1)
        LIMIT 1
      `,
      [email.trim()],
    )

  const row = result.rows[0]
  const passwordHash = row?.password_hash || DUMMY_PASSWORD_HASH
  const passwordMatches = verifyAdminPassword(password, passwordHash)

  if (
    !row ||
    row.status !== "active" ||
    !row.password_hash ||
    !passwordMatches
  ) {
    return null
  }

  await getPostgresPool().query(
    `
      UPDATE sf_users
      SET
        last_login_at = now(),
        updated_at = now()
      WHERE id = $1
    `,
    [row.id],
  )

  return {
    id: row.id,
    name: row.name,
    email: row.email,
  }
}


export async function authenticateAdminGoogleUser(
  googleSubject: string,
  email: string,
): Promise<AuthenticatedAdminUser | null> {
  const result = await getPostgresPool().query<AdminUserCredentialRow>(
    `
      SELECT id, name, email, password_hash, status
      FROM sf_users
      WHERE google_subject = $1
      LIMIT 1
    `,
    [googleSubject.trim()],
  )

  const row = result.rows[0]
  if (
    !row ||
    row.status !== "active" ||
    row.email.trim().toLowerCase() !== email.trim().toLowerCase()
  ) {
    return null
  }

  await getPostgresPool().query(
    `
      UPDATE sf_users
      SET last_login_at = now(), updated_at = now()
      WHERE id = $1
    `,
    [row.id],
  )

  return {
    id: row.id,
    name: row.name,
    email: row.email,
  }
}

export async function upgradeLegacyAdminPassword(
  email: string,
  password: string,
) {
  const state =
    await getAdminUserCredentialState(email)

  if (
    !state ||
    !state.active ||
    state.passwordReady
  ) {
    return false
  }

  const hash = hashAdminPassword(password)

  const result = await getPostgresPool().query(
    `
      UPDATE sf_users
      SET
        password_hash = $2,
        password_updated_at = now(),
        last_login_at = now(),
        updated_at = now()
      WHERE id = $1
        AND password_hash IS NULL
      RETURNING id
    `,
    [state.userId, hash],
  )

  return Boolean(result.rowCount)
}


export async function changeAdminUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const result =
    await getPostgresPool().query<{
      password_hash: string | null
      status: string
    }>(
      `
        SELECT
          password_hash,
          status
        FROM sf_users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    )

  const row = result.rows[0]

  if (
    !row ||
    row.status !== "active" ||
    !row.password_hash ||
    !verifyAdminPassword(
      currentPassword,
      row.password_hash,
    )
  ) {
    throw new Error(
      "Senha atual incorreta.",
    )
  }

  if (
    currentPassword === newPassword
  ) {
    throw new Error(
      "A nova senha precisa ser diferente da atual.",
    )
  }

  const passwordHash =
    hashAdminPassword(newPassword)

  await getPostgresPool().query(
    `
      UPDATE sf_users
      SET
        password_hash = $2,
        password_updated_at = now(),
        session_version = session_version + 1,
        updated_at = now()
      WHERE id = $1
    `,
    [userId, passwordHash],
  )

  await revokeOutstandingAuthTokens(
    userId,
    "password_reset",
  )

  return true
}

export async function getPasswordResetPreview(
  token: string,
) {
  const valid =
    await getValidAuthToken(
      token,
      "password_reset",
    )

  if (!valid) return null

  const result =
    await getPostgresPool().query<{
      name: string
      email: string
      status: string
    }>(
      `
        SELECT
          name,
          email,
          status
        FROM sf_users
        WHERE id = $1
        LIMIT 1
      `,
      [valid.userId],
    )

  const user = result.rows[0]

  if (
    !user ||
    user.status === "blocked"
  ) {
    return null
  }

  return {
    tokenId: valid.id,
    userId: valid.userId,
    organizationId:
      valid.organizationId,
    name: user.name,
    email: user.email,
    expiresAt: valid.expiresAt,
  }
}

export async function resetAdminUserPassword(
  token: string,
  newPassword: string,
) {
  const preview =
    await getPasswordResetPreview(token)

  if (!preview) {
    throw new Error(
      "Link de recuperação inválido ou expirado.",
    )
  }

  const passwordHash =
    hashAdminPassword(newPassword)

  const client =
    await getPostgresPool().connect()

  try {
    await client.query("BEGIN")

    const consumed =
      await client.query(
        `
          UPDATE sf_auth_tokens
          SET used_at = now()
          WHERE id = $1
            AND used_at IS NULL
            AND expires_at > now()
          RETURNING id
        `,
        [preview.tokenId],
      )

    if (!consumed.rowCount) {
      throw new Error(
        "Este link já foi usado ou expirou.",
      )
    }

    await client.query(
      `
        UPDATE sf_users
        SET
          password_hash = $2,
          password_updated_at = now(),
          session_version = session_version + 1,
          status = CASE
            WHEN status = 'blocked' THEN status
            ELSE 'active'
          END,
          updated_at = now()
        WHERE id = $1
      `,
      [
        preview.userId,
        passwordHash,
      ],
    )

    await client.query(
      `
        UPDATE sf_auth_tokens
        SET used_at = COALESCE(used_at, now())
        WHERE user_id = $1
          AND id <> $2
          AND used_at IS NULL
      `,
      [
        preview.userId,
        preview.tokenId,
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
    email: preview.email,
  }
}
