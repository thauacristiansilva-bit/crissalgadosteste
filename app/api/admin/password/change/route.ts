import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  SUPERADMIN_SESSION_COOKIE,
} from "@/lib/auth"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  changeAdminUserPassword,
} from "@/lib/admin-user-db"
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

const CHANGE_PASSWORD_LIMIT = 8
const CHANGE_PASSWORD_WINDOW_MS =
  15 * 60 * 1000

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  retryAfterSeconds = 0,
) {
  const response =
    NextResponse.json(
      body,
      { status },
    )

  response.headers.set(
    "Cache-Control",
    "no-store",
  )

  if (retryAfterSeconds > 0) {
    response.headers.set(
      "Retry-After",
      String(
        retryAfterSeconds,
      ),
    )
  }

  return response
}

export async function POST(
  request: Request,
) {
  if (
    !requestIsSameOrigin(
      request,
    )
  ) {
    return jsonResponse(
      {
        error:
          "Origem da requisição não autorizada.",
      },
      403,
    )
  }

  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return jsonResponse(
      {
        error:
          "Sessão multiempresa inválida.",
      },
      401,
    )
  }

  const rateKey =
    authRateLimitKey(
      "account",
      `password-change:${session.userId}:${requestIp(request)}`,
    )

  const rateState =
    await checkAuthRateLimit(
      rateKey,
      CHANGE_PASSWORD_LIMIT,
      CHANGE_PASSWORD_WINDOW_MS,
    )

  if (!rateState.allowed) {
    return jsonResponse(
      {
        error:
          "Muitas tentativas de alteração de senha. Tente novamente mais tarde.",
      },
      429,
      rateState.retryAfterSeconds,
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        currentPassword?: string
        newPassword?: string
      }
    | null

  try {
    await changeAdminUserPassword(
      session.userId,
      body?.currentPassword || "",
      body?.newPassword || "",
    )

    await clearAuthFailures(
      rateKey,
    )

    const response =
      jsonResponse({
        ok: true,
        relogin: true,
      })

    response.cookies.delete(
      ADMIN_SESSION_COOKIE,
    )
    response.cookies.delete(
      LEGACY_ADMIN_SESSION_COOKIE,
    )
    response.cookies.delete(
      SUPERADMIN_SESSION_COOKIE,
    )

    return response
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível alterar a senha."

    if (
      message ===
      "Senha atual incorreta."
    ) {
      await registerAuthFailure(
        rateKey,
        CHANGE_PASSWORD_WINDOW_MS,
      )
    }

    return jsonResponse(
      {
        error: message,
      },
      400,
    )
  }
}
