import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  SUPERADMIN_SESSION_COOKIE,
  createSessionToken,
  createSuperadminSessionToken,
} from "@/lib/auth"
import { authenticateAdminUser } from "@/lib/admin-user-db"
import {
  getDefaultAdminTenantContextForUserId,
} from "@/lib/tenant-context"
import {
  userCanReceiveSuperadminCpfSession,
} from "@/lib/superadmin-auth"
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

function jsonError(
  message: string,
  status: number,
  retryAfterSeconds = 0,
) {
  const response = NextResponse.json(
    { error: message },
    { status },
  )

  response.headers.set(
    "Cache-Control",
    "no-store",
  )

  if (retryAfterSeconds > 0) {
    response.headers.set(
      "Retry-After",
      String(retryAfterSeconds),
    )
  }

  return response
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    priority: "high" as const,
  }
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  }
}

function setSessionCookies(
  response: NextResponse,
  token: string,
) {
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    token,
    sessionCookieOptions(),
  )

  response.cookies.set(
    LEGACY_ADMIN_SESSION_COOKIE,
    "",
    clearCookieOptions(),
  )
}

function clearSuperadminCookie(
  response: NextResponse,
) {
  response.cookies.set(
    SUPERADMIN_SESSION_COOKIE,
    "",
    clearCookieOptions(),
  )
}

function identifierIsCpf(
  identifier: string,
) {
  if (identifier.includes("@")) {
    return false
  }

  return (
    identifier.replace(/\D/g, "").length === 11
  )
}

export async function POST(
  request: Request,
) {
  if (!requestIsSameOrigin(request)) {
    return jsonError(
      "Origem da requisição não autorizada.",
      403,
    )
  }

  const ipKey = authRateLimitKey(
    "ip",
    requestIp(request),
  )

  const ipLimit = checkAuthRateLimit(
    ipKey,
    IP_LIMIT,
    RATE_WINDOW_MS,
  )

  if (!ipLimit.allowed) {
    return jsonError(
      "Muitas tentativas de login. Tente novamente mais tarde.",
      429,
      ipLimit.retryAfterSeconds,
    )
  }

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          identifier?: string
          email?: string
          password?: string
        }
      | null

  const identifier =
    body?.identifier?.trim() ||
    body?.email?.trim() ||
    ""

  const password =
    body?.password || ""

  if (!identifier || !password) {
    registerAuthFailure(
      ipKey,
      RATE_WINDOW_MS,
    )

    return jsonError(
      "CPF/e-mail ou senha inválidos.",
      401,
    )
  }

  const normalizedAccountKey =
    identifier
      .trim()
      .toLowerCase()
      .replace(/[.\-\s]/g, "")

  const accountKey = authRateLimitKey(
    "account",
    normalizedAccountKey,
  )

  const accountLimit =
    checkAuthRateLimit(
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
    const user =
      await authenticateAdminUser(
        identifier,
        password,
      )

    if (!user) {
      registerAuthFailure(
        ipKey,
        RATE_WINDOW_MS,
      )
      registerAuthFailure(
        accountKey,
        RATE_WINDOW_MS,
      )

      return jsonError(
        "CPF/e-mail ou senha inválidos.",
        401,
      )
    }

    const tenantContext =
      await getDefaultAdminTenantContextForUserId(
        user.id,
      )

    if (!tenantContext) {
      registerAuthFailure(
        accountKey,
        RATE_WINDOW_MS,
      )

      return jsonError(
        "Não foi possível entrar nesta conta.",
        403,
      )
    }

    const cpfLogin =
      identifierIsCpf(identifier)

    const allowSuperadmin =
      cpfLogin &&
      (await userCanReceiveSuperadminCpfSession(
        user.id,
      ))

    clearAuthFailures(accountKey)

    const redirectTo =
      allowSuperadmin
        ? "/superadmin"
        : "/admin"

    const response =
      NextResponse.json({
        ok: true,
        sessionMode: "tenant",
        authSource:
          cpfLogin ? "cpf" : "email",
        redirectTo,
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    setSessionCookies(
      response,
      createSessionToken(
        tenantContext,
      ),
    )

    if (allowSuperadmin) {
      response.cookies.set(
        SUPERADMIN_SESSION_COOKIE,
        createSuperadminSessionToken(
          user.id,
        ),
        sessionCookieOptions(),
      )
    } else {
      clearSuperadminCookie(response)
    }

    return response
  } catch (error) {
    console.error(
      "[SaborFlow] Falha no login PostgreSQL:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Não foi possível validar o login no momento.",
      503,
    )
  }
}
