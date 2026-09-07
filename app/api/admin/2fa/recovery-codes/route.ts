import { NextResponse } from "next/server"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
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
import {
  regenerateRecoveryCodes,
} from "@/lib/security/two-factor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ACCOUNT_LIMIT = 6
const IP_LIMIT = 20
const RATE_WINDOW_MS =
  10 * 60 * 1000

function jsonError(
  message: string,
  status: number,
  retryAfterSeconds = 0,
) {
  const response =
    NextResponse.json(
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
    return jsonError(
      "Origem da requisição não autorizada.",
      403,
    )
  }

  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return jsonError(
      "Sessão administrativa inválida.",
      401,
    )
  }

  const accountKey =
    authRateLimitKey(
      "account",
      `2fa-recovery:${session.userId}`,
    )

  const ipKey =
    authRateLimitKey(
      "ip",
      `2fa-recovery:${requestIp(request)}`,
    )

  const accountState =
    checkAuthRateLimit(
      accountKey,
      ACCOUNT_LIMIT,
      RATE_WINDOW_MS,
    )

  if (!accountState.allowed) {
    return jsonError(
      "Muitas tentativas. Tente novamente mais tarde.",
      429,
      accountState.retryAfterSeconds,
    )
  }

  const ipState =
    checkAuthRateLimit(
      ipKey,
      IP_LIMIT,
      RATE_WINDOW_MS,
    )

  if (!ipState.allowed) {
    return jsonError(
      "Muitas tentativas. Tente novamente mais tarde.",
      429,
      ipState.retryAfterSeconds,
    )
  }

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          code?: string
        }
      | null

  const code =
    body?.code?.trim() || ""

  if (!/^\d{6}$/.test(code)) {
    registerAuthFailure(
      accountKey,
      RATE_WINDOW_MS,
    )
    registerAuthFailure(
      ipKey,
      RATE_WINDOW_MS,
    )

    return jsonError(
      "Informe o código de 6 dígitos do aplicativo autenticador.",
      400,
    )
  }

  try {
    const result =
      await regenerateRecoveryCodes(
        session.userId,
        code,
      )

    if (!result) {
      registerAuthFailure(
        accountKey,
        RATE_WINDOW_MS,
      )
      registerAuthFailure(
        ipKey,
        RATE_WINDOW_MS,
      )

      return jsonError(
        "Código inválido ou já utilizado. Se acabou de entrar, aguarde o próximo código do autenticador.",
        401,
      )
    }

    clearAuthFailures(
      accountKey,
    )
    clearAuthFailures(
      ipKey,
    )

    const response =
      NextResponse.json({
        ok: true,
        recoveryCodes:
          result.recoveryCodes,
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    return response
  } catch (error) {
    console.error(
      "[SaborFlow 2FA] Falha ao gerar novos códigos de recuperação:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Não foi possível gerar novos códigos de recuperação.",
      503,
    )
  }
}
