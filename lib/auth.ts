import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import type { AdminTenantContext, OrganizationRole } from "@/lib/tenant-context"
import { demoOrganizationIsUsable } from "@/lib/demo-policy"

export const ADMIN_SESSION_COOKIE = "saborflow_admin_session"
export const LEGACY_ADMIN_SESSION_COOKIE = "cris_admin_session"

export const getAdminEmail = () =>
  process.env.ADMIN_EMAIL || "admin@crissalgados.com"

const getAdminPassword = () =>
  process.env.ADMIN_PASSWORD || "cris1234"

export const getAdminLoginMode = () =>
  process.env.ADMIN_LOGIN_MODE === "postgres"
    ? "postgres"
    : "transition"

export const legacyAdminLoginAllowed = () =>
  getAdminLoginMode() === "transition"

export const isSessionSecretConfigured = () =>
  Boolean(process.env.SESSION_SECRET?.trim())

const getSessionSecret = () => {
  const configured = process.env.SESSION_SECRET?.trim()

  if (configured) return configured

  if (getAdminLoginMode() === "postgres") {
    throw new Error(
      "SESSION_SECRET é obrigatório com ADMIN_LOGIN_MODE=postgres.",
    )
  }

  return `${getAdminPassword()}::cris-salgados-dev-secret`
}

export type AdminSession =
  | {
      mode: "tenant"
      userId: string
      email: string
      organizationId: string
      organizationName: string
      organizationSlug: string
      role: OrganizationRole
      sessionVersion: number
      expiresAt: number
    }
  | {
      mode: "legacy"
      email: string
    }

export function credentialsAreValid(email: string, password: string) {
  return (
    email.trim().toLowerCase() === getAdminEmail().toLowerCase() &&
    password === getAdminPassword()
  )
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url")
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)

  if (actualBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(actualBuffer, expectedBuffer)
}

function createLegacySessionToken() {
  return createHmac("sha256", getSessionSecret())
    .update(`cris-admin:${getAdminEmail().toLowerCase()}`)
    .digest("hex")
}

function legacySessionTokenIsValid(token?: string | null) {
  if (!token) return false
  return signaturesMatch(token, createLegacySessionToken())
}

export function createSessionToken(
  context?: AdminTenantContext | null,
) {
  if (!context) {
    // Transição segura: enquanto a primeira organização ainda não foi
    // inicializada, o login atual continua funcionando.
    return createLegacySessionToken()
  }

  const payload = {
    v: 3,
    userId: context.userId,
    email: context.email,
    organizationId: context.organizationId,
    organizationName: context.organizationName,
    organizationSlug: context.organizationSlug,
    role: context.role,
    sessionVersion: context.sessionVersion,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `v3.${encoded}.${sign(encoded)}`
}

function parseTenantSessionToken(token?: string | null): AdminSession | null {
  if (!token || (!token.startsWith("v2.") && !token.startsWith("v3."))) return null

  const parts = token.split(".")
  if (parts.length !== 3) return null

  const [, encoded, signature] = parts
  if (!encoded || !signature) return null
  if (!signaturesMatch(signature, sign(encoded))) return null

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as {
      v?: number
      userId?: string
      email?: string
      organizationId?: string
      organizationName?: string
      organizationSlug?: string
      role?: OrganizationRole
      sessionVersion?: number
      expiresAt?: number
    }

    if (
      ![2, 3].includes(Number(payload.v)) ||
      !payload.userId ||
      !payload.email ||
      !payload.organizationId ||
      !payload.organizationName ||
      !payload.organizationSlug ||
      !payload.role ||
      !payload.expiresAt ||
      payload.expiresAt <= Date.now()
    ) {
      return null
    }

    return {
      mode: "tenant",
      userId: payload.userId,
      email: payload.email,
      organizationId: payload.organizationId,
      organizationName: payload.organizationName,
      organizationSlug: payload.organizationSlug,
      role: payload.role,
      sessionVersion: Number(payload.sessionVersion || 1),
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}

export function sessionTokenIsValid(token?: string | null) {
  return Boolean(
    parseTenantSessionToken(token) ||
      legacySessionTokenIsValid(token),
  )
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies()

  const tenantToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const tenantSession = parseTenantSessionToken(tenantToken)
  if (tenantSession?.mode === "tenant") {
    if (await demoOrganizationIsUsable(tenantSession.organizationId)) {
      return tenantSession
    }
    return null
  }

  const legacyToken =
    cookieStore.get(LEGACY_ADMIN_SESSION_COOKIE)?.value ||
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  if (legacySessionTokenIsValid(legacyToken)) {
    return {
      mode: "legacy",
      email: getAdminEmail(),
    }
  }

  return null
}

export async function isAdminAuthenticated() {
  return Boolean(await getAdminSession())
}
