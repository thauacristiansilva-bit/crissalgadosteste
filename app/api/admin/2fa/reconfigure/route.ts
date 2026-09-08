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
  beginTwoFactorReconfiguration,
  cancelTwoFactorReconfiguration,
  confirmTwoFactorReconfiguration,
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

function rateLimitKeys(
  action: string,
  userId: string,
  request: Request,
) {
  return {
    accountKey:
      authRateLimitKey(
        "account",
        `2fa-reconfigure:${action}:${userId}`,
      ),
    ipKey:
      authRateLimitKey(
        "ip",
        `2fa-reconfigure:${action}:${requestIp(request)}`,
      ),
  }
}

async function checkLimits(
  accountKey: string,
  ipKey: string,
) {
  const accountState =
    await checkAuthRateLimit(
      accountKey,
      ACCOUNT_LIMIT,
      RATE_WINDOW_MS,
    )

  if (!accountState.allowed) {
    return {
      allowed: false,
      retryAfterSeconds:
        accountState.retryAfterSeconds,
    }
  }

  const ipState =
    await checkAuthRateLimit(
      ipKey,
      IP_LIMIT,
      RATE_WINDOW_MS,
    )

  if (!ipState.allowed) {
    return {
      allowed: false,
      retryAfterSeconds:
        ipState.retryAfterSeconds,
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  }
}

async function registerFailure(
  accountKey: string,
  ipKey: string,
) {
  await registerAuthFailure(
    accountKey,
    RATE_WINDOW_MS,
  )
  await registerAuthFailure(
    ipKey,
    RATE_WINDOW_MS,
  )
}

async function clearFailures(
  accountKey: string,
  ipKey: string,
) {
  await clearAuthFailures(
    accountKey,
  )
  await clearAuthFailures(
    ipKey,
  )
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

  const {
    accountKey,
    ipKey,
  } = rateLimitKeys(
    "start",
    session.userId,
    request,
  )

  const limit =
    await checkLimits(
      accountKey,
      ipKey,
    )

  if (!limit.allowed) {
    return jsonError(
      "Muitas tentativas. Tente novamente mais tarde.",
      429,
      limit.retryAfterSeconds,
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

  if (!code) {
    await registerFailure(
      accountKey,
      ipKey,
    )

    return jsonError(
      "Informe o código atual do autenticador ou um código de recuperação.",
      400,
    )
  }

  try {
    const result =
      await beginTwoFactorReconfiguration(
        session.userId,
        session.email,
        code,
      )

    if (!result) {
      await registerFailure(
        accountKey,
        ipKey,
      )

      return jsonError(
        "Código atual inválido ou já utilizado.",
        401,
      )
    }

    await clearFailures(
      accountKey,
      ipKey,
    )

    const response =
      NextResponse.json({
        ok: true,
        manualKey:
          result.manualKey,
        expiresAt:
          result.expiresAt,
        qrUrl:
          `/api/admin/2fa/reconfigure/qr?v=${Date.now()}`,
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    return response
  } catch (error) {
    console.error(
      "[SaborFlow 2FA] Falha ao iniciar troca do autenticador:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Não foi possível iniciar a troca do autenticador.",
      503,
    )
  }
}

export async function PATCH(
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

  const {
    accountKey,
    ipKey,
  } = rateLimitKeys(
    "confirm",
    session.userId,
    request,
  )

  const limit =
    await checkLimits(
      accountKey,
      ipKey,
    )

  if (!limit.allowed) {
    return jsonError(
      "Muitas tentativas. Tente novamente mais tarde.",
      429,
      limit.retryAfterSeconds,
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
    await registerFailure(
      accountKey,
      ipKey,
    )

    return jsonError(
      "Informe o código de 6 dígitos do novo autenticador.",
      400,
    )
  }

  try {
    const result =
      await confirmTwoFactorReconfiguration(
        session.userId,
        code,
      )

    if (!result) {
      await registerFailure(
        accountKey,
        ipKey,
      )

      return jsonError(
        "Código do novo autenticador inválido ou a troca expirou.",
        401,
      )
    }

    await clearFailures(
      accountKey,
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
      "[SaborFlow 2FA] Falha ao confirmar troca do autenticador:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Não foi possível confirmar a troca do autenticador.",
      503,
    )
  }
}

export async function DELETE(
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

  try {
    await cancelTwoFactorReconfiguration(
      session.userId,
    )

    const response =
      NextResponse.json({
        ok: true,
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    return response
  } catch (error) {
    console.error(
      "[SaborFlow 2FA] Falha ao cancelar troca do autenticador:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Não foi possível cancelar a troca do autenticador.",
      503,
    )
  }
}
