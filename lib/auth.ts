import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import type { AdminTenantContext, OrganizationRole } from "@/lib/tenant-context"
import { demoOrganizationIsUsable } from "@/lib/demo-policy"
import { enterTenantRlsContext } from "@/lib/rls-context"

export const ADMIN_SESSION_COOKIE = "saborflow_admin_session"
export const SUPERADMIN_SESSION_COOKIE = "saborflow_superadmin_session"
// Mantido apenas para que logout/login removam cookies antigos do navegador.
export const LEGACY_ADMIN_SESSION_COOKIE = "cris_admin_session"

export const ADMIN_SESSION_IDLE_SECONDS = 60 * 60 * 24 * 10
const ADMIN_SESSION_IDLE_MS = ADMIN_SESSION_IDLE_SECONDS * 1000

/** @deprecated Mantido apenas para compatibilidade de componentes antigos. */
export const getAdminEmail = () => ""

export const getAdminLoginMode = () => "postgres" as const
export const legacyAdminLoginAllowed = () => false

export const isSessionSecretConfigured = () =>
  Boolean(process.env.SESSION_SECRET?.trim())

const getSessionSecret = () => {
  const configured = process.env.SESSION_SECRET?.trim()
  if (!configured) {
    throw new Error("SESSION_SECRET é obrigatório na Fase 25.")
  }
  return configured
}

export type AdminSession =
  | {
      mode: "tenant"
      sessionId: string
      userId: string
      email: string
      organizationId: string
      organizationName: string
      organizationSlug: string
      role: OrganizationRole
      sessionVersion: number
      issuedAt: number
      expiresAt: number
    }
  | {
      // Tipo mantido temporariamente para compatibilidade de componentes antigos.
      // getAdminSession() nunca produz esta variante após a Fase 25.
      mode: "legacy"
      email: string
    }

type SuperadminSessionPayload = {
  v: 2
  purpose: "superadmin-cpf"
  sessionId: string
  userId: string
  issuedAt: number
  expiresAt: number
}

/** @deprecated Login legado foi desativado na Fase 25. */
export function credentialsAreValid(_email: string, _password: string) {
  return false
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

function tenantTokenFromSession(
  session: Pick<
    Extract<AdminSession, { mode: "tenant" }>,
    | "sessionId"
    | "userId"
    | "email"
    | "organizationId"
    | "organizationName"
    | "organizationSlug"
    | "role"
    | "sessionVersion"
  >,
) {
  const now = Date.now()
  const payload = {
    v: 4,
    sessionId: session.sessionId,
    userId: session.userId,
    email: session.email,
    organizationId: session.organizationId,
    organizationName: session.organizationName,
    organizationSlug: session.organizationSlug,
    role: session.role,
    sessionVersion: session.sessionVersion,
    issuedAt: now,
    expiresAt: now + ADMIN_SESSION_IDLE_MS,
  }

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `v4.${encoded}.${sign(encoded)}`
}

export function createSessionToken(
  context: AdminTenantContext,
  sessionId: string,
) {
  if (!context) {
    throw new Error("Sessão administrativa exige contexto tenant PostgreSQL.")
  }

  const normalizedSessionId = sessionId.trim()
  if (!normalizedSessionId) {
    throw new Error("Sessão administrativa exige identificador persistente.")
  }

  return tenantTokenFromSession({
    sessionId: normalizedSessionId,
    userId: context.userId,
    email: context.email,
    organizationId: context.organizationId,
    organizationName: context.organizationName,
    organizationSlug: context.organizationSlug,
    role: context.role,
    sessionVersion: context.sessionVersion,
  })
}

export function createSuperadminSessionToken(
  userId: string,
  sessionId: string,
) {
  const normalizedUserId = userId.trim()
  const normalizedSessionId = sessionId.trim()

  if (!normalizedUserId || !normalizedSessionId) {
    throw new Error(
      "Sessão Superadmin exige usuário e sessão persistente válidos.",
    )
  }

  const now = Date.now()
  const payload: SuperadminSessionPayload = {
    v: 2,
    purpose: "superadmin-cpf",
    sessionId: normalizedSessionId,
    userId: normalizedUserId,
    issuedAt: now,
    expiresAt: now + ADMIN_SESSION_IDLE_MS,
  }

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = sign(`superadmin:${encoded}`)
  return `sa2.${encoded}.${signature}`
}

export function parseAdminSessionToken(
  token?: string | null,
): AdminSession | null {
  // A Etapa 13.6 invalida os antigos v2/v3 porque eles não possuem sessionId
  // persistente e, portanto, não podem ser revogados por dispositivo.
  if (!token || !token.startsWith("v4.")) {
    return null
  }

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
      sessionId?: string
      userId?: string
      email?: string
      organizationId?: string
      organizationName?: string
      organizationSlug?: string
      role?: OrganizationRole
      sessionVersion?: number
      issuedAt?: number
      expiresAt?: number
    }

    if (
      payload.v !== 4 ||
      !payload.sessionId ||
      !payload.userId ||
      !payload.email ||
      !payload.organizationId ||
      !payload.organizationName ||
      !payload.organizationSlug ||
      !payload.role ||
      !payload.sessionVersion ||
      !payload.issuedAt ||
      !payload.expiresAt ||
      payload.expiresAt <= Date.now()
    ) {
      return null
    }

    return {
      mode: "tenant",
      sessionId: payload.sessionId,
      userId: payload.userId,
      email: payload.email,
      organizationId: payload.organizationId,
      organizationName: payload.organizationName,
      organizationSlug: payload.organizationSlug,
      role: payload.role,
      sessionVersion: Number(payload.sessionVersion),
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}

function parseSuperadminSessionToken(
  token?: string | null,
): SuperadminSessionPayload | null {
  if (!token || !token.startsWith("sa2.")) return null

  const parts = token.split(".")
  if (parts.length !== 3) return null

  const [, encoded, signature] = parts
  if (!encoded || !signature) return null

  const expectedSignature = sign(`superadmin:${encoded}`)
  if (!signaturesMatch(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SuperadminSessionPayload>

    if (
      payload.v !== 2 ||
      payload.purpose !== "superadmin-cpf" ||
      !payload.sessionId ||
      !payload.userId ||
      !payload.issuedAt ||
      !payload.expiresAt ||
      payload.expiresAt <= Date.now()
    ) {
      return null
    }

    return {
      v: 2,
      purpose: "superadmin-cpf",
      sessionId: payload.sessionId,
      userId: payload.userId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}

export function refreshAdminSessionToken(token?: string | null) {
  const session = parseAdminSessionToken(token)
  if (!session || session.mode !== "tenant") return null

  return tenantTokenFromSession({
    sessionId: session.sessionId,
    userId: session.userId,
    email: session.email,
    organizationId: session.organizationId,
    organizationName: session.organizationName,
    organizationSlug: session.organizationSlug,
    role: session.role,
    sessionVersion: session.sessionVersion,
  })
}

export function refreshSuperadminSessionToken(token?: string | null) {
  const session = parseSuperadminSessionToken(token)
  if (!session) return null

  return createSuperadminSessionToken(
    session.userId,
    session.sessionId,
  )
}

export function sessionTokenIsValid(token?: string | null) {
  return Boolean(parseAdminSessionToken(token))
}

export async function hasSuperadminCpfSession(
  userId: string,
  sessionId: string,
) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SUPERADMIN_SESSION_COOKIE)?.value
  const session = parseSuperadminSessionToken(token)

  return Boolean(
    session &&
      session.userId === userId.trim() &&
      session.sessionId === sessionId.trim(),
  )
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  const tenantToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const tenantSession = parseAdminSessionToken(tenantToken)

  if (tenantSession?.mode !== "tenant") return null

  enterTenantRlsContext(
    tenantSession.organizationId,
    tenantSession.userId,
    "tenant-session",
  )

  if (await demoOrganizationIsUsable(tenantSession.organizationId)) {
    return tenantSession
  }

  return null
}

export async function isAdminAuthenticated() {
  return Boolean(await getAdminSession())
}
