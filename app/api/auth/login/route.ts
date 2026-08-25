import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  createSessionToken,
} from "@/lib/auth"
import { authenticateAdminUser } from "@/lib/admin-user-db"
import {
  getDefaultAdminTenantContextForUserId,
} from "@/lib/tenant-context"
import {
  authRateLimitKey,
  checkAuthRateLimit,
  clearAuthFailures,
  registerAuthFailure,
} from "@/lib/security/rate-limit"
import {
  requestIp,
  requestIsSameOrigin,
} from "@/lib/security/request-security"

const ACCOUNT_LIMIT = 8
const IP_LIMIT = 30
const RATE_WINDOW_MS = 15 * 60 * 1000

function jsonError(message: string, status: number, retryAfterSeconds = 0) {
  const response = NextResponse.json({ error: message }, { status })
  response.headers.set("Cache-Control", "no-store")
  if (retryAfterSeconds > 0) {
    response.headers.set("Retry-After", String(retryAfterSeconds))
  }
  return response
}

function setSessionCookies(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    priority: "high",
  })

  // Limpeza definitiva de cookie pré-Fase 25.
  response.cookies.set(LEGACY_ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return jsonError("Origem da requisição não autorizada.", 403)
  }

  const ipKey = authRateLimitKey("ip", requestIp(request))
  const ipLimit = checkAuthRateLimit(ipKey, IP_LIMIT, RATE_WINDOW_MS)
  if (!ipLimit.allowed) {
    return jsonError(
      "Muitas tentativas de login. Tente novamente mais tarde.",
      429,
      ipLimit.retryAfterSeconds,
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null

  if (!body?.email || !body?.password) {
    registerAuthFailure(ipKey, RATE_WINDOW_MS)
    return jsonError("E-mail ou senha inválidos.", 401)
  }

  const email = body.email.trim().toLowerCase()
  const password = body.password
  const accountKey = authRateLimitKey("account", email)
  const accountLimit = checkAuthRateLimit(
    accountKey,
    ACCOUNT_LIMIT,
    RATE_WINDOW_MS,
  )

  if (!accountLimit.allowed) {
    return jsonError(
      "Muitas tentativas de login. Tente novamente mais tarde.",
      429,
      accountLimit.retryAfterSeconds,
    )
  }

  try {
    const user = await authenticateAdminUser(email, password)
    if (!user) {
      registerAuthFailure(ipKey, RATE_WINDOW_MS)
      registerAuthFailure(accountKey, RATE_WINDOW_MS)
      return jsonError("E-mail ou senha inválidos.", 401)
    }

    const tenantContext =
      await getDefaultAdminTenantContextForUserId(user.id)

    if (!tenantContext) {
      registerAuthFailure(accountKey, RATE_WINDOW_MS)
      return jsonError("Não foi possível entrar nesta conta.", 403)
    }

    clearAuthFailures(accountKey)

    const response = NextResponse.json({
      ok: true,
      sessionMode: "tenant",
      authSource: "postgres",
    })

    response.headers.set("Cache-Control", "no-store")
    setSessionCookies(response, createSessionToken(tenantContext))
    return response
  } catch (error) {
    console.error(
      "[SaborFlow] Falha no login PostgreSQL:",
      error instanceof Error ? error.message : error,
    )

    return jsonError("Não foi possível validar o login no momento.", 503)
  }
}
