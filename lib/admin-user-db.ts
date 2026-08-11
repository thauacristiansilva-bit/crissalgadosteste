import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"

const PREFIX = "scrypt$v1"

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
  if (password.length < 8) {
    throw new Error(
      "A senha administrativa deve ter pelo menos 8 caracteres.",
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

  if (
    !row ||
    row.status !== "active" ||
    !row.password_hash ||
    !verifyAdminPassword(
      password,
      row.password_hash,
    )
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
