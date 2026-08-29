import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  SUPERADMIN_SESSION_COOKIE,
  createSessionToken,
} from "@/lib/auth"
import { authenticateAdminGoogleUser } from "@/lib/admin-user-db"
import { verifyGoogleCredential } from "@/lib/auth-providers/google"
import { getDefaultAdminTenantContextForUserId } from "@/lib/tenant-context"
import {
  authRateLimitKey,
  checkAuthRateLimit,
  registerAuthFailure,
} from "@/lib/security/rate-limit"
import {
  requestIp,
  requestIsSameOrigin,
} from "@/lib/security/request-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LIMIT = 20
const WINDOW_MS = 15 * 60 * 1000

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

  // Login por Google nunca concede a autorização especial do Superadmin.
  response.cookies.set(
    SUPERADMIN_SESSION_COOKIE,
    "",
    clearCookieOptions(),
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

  const key = authRateLimitKey(
    "ip",
    `admin-google:${requestIp(request)}`,
  )

  const state = checkAuthRateLimit(
    key,
    LIMIT,
    WINDOW_MS,
  )

  if (!state.allowed) {
    return jsonError(
      "Muitas tentativas. Tente novamente mais tarde.",
      429,
      state.retryAfterSeconds,
    )
  }

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          credential?: string
        }
      | null

  if (!body?.credential) {
    registerAuthFailure(
      key,
      WINDOW_MS,
    )

    return jsonError(
      "Não foi possível validar sua Conta Google.",
      400,
    )
  }

  try {
    const google =
      await verifyGoogleCredential(
        body.credential,
      )

    const user =
      await authenticateAdminGoogleUser(
        google.subject,
        google.email,
      )

    if (!user) {
      registerAuthFailure(
        key,
        WINDOW_MS,
      )

      return jsonError(
        "Esta Conta Google não está vinculada a um usuário administrativo do SaborFlow.",
        403,
      )
    }

    const tenantContext =
      await getDefaultAdminTenantContextForUserId(
        user.id,
      )

    if (!tenantContext) {
      registerAuthFailure(
        key,
        WINDOW_MS,
      )

      return jsonError(
        "Não foi possível entrar nesta conta.",
        403,
      )
    }

    const response =
      NextResponse.json({
        ok: true,
        authSource: "google",
        redirectTo: "/admin",
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

    return response
  } catch (reason) {
    registerAuthFailure(
      key,
      WINDOW_MS,
    )

    console.error(
      "[SaborFlow Google Admin] Falha ao autenticar:",
      reason instanceof Error
        ? reason.message
        : reason,
    )

    return jsonError(
      "Não foi possível entrar com Google no momento.",
      503,
    )
  }
}
