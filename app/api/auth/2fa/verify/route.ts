import {
  cookies,
} from "next/headers"
import {
  NextResponse,
} from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_IDLE_SECONDS,
  LEGACY_ADMIN_SESSION_COOKIE,
  SUPERADMIN_SESSION_COOKIE,
  createSessionToken,
  createSuperadminSessionToken,
} from "@/lib/auth"
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
import {
  createAdminSessionRecord,
} from "@/lib/security/admin-sessions"
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  clearTwoFactorChallengeCookieOptions,
  parseTwoFactorChallenge,
} from "@/lib/security/two-factor-challenge"
import {
  activateTwoFactor,
  markAdminUserLoginCompleted,
  verifySecondFactor,
} from "@/lib/security/two-factor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ACCOUNT_LIMIT = 8
const IP_LIMIT = 30
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

  if (
    retryAfterSeconds > 0
  ) {
    response.headers.set(
      "Retry-After",
      String(
        retryAfterSeconds,
      ),
    )
  }

  return response
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      process.env.NODE_ENV ===
      "production",
    path: "/",
    maxAge:
      ADMIN_SESSION_IDLE_SECONDS,
    priority: "high" as const,
  }
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      process.env.NODE_ENV ===
      "production",
    path: "/",
    maxAge: 0,
  }
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

  const store =
    await cookies()

  const challenge =
    parseTwoFactorChallenge(
      store.get(
        TWO_FACTOR_CHALLENGE_COOKIE,
      )?.value,
    )

  if (!challenge) {
    return jsonError(
      "Sua verificação expirou. Entre novamente.",
      401,
    )
  }

  const accountKey =
    authRateLimitKey(
      "account",
      `2fa:${challenge.userId}`,
    )

  const ipKey =
    authRateLimitKey(
      "ip",
      `2fa:${requestIp(request)}`,
    )

  const accountState =
    checkAuthRateLimit(
      accountKey,
      ACCOUNT_LIMIT,
      RATE_WINDOW_MS,
    )

  if (
    !accountState.allowed
  ) {
    return jsonError(
      "Muitas tentativas de verificação. Tente novamente mais tarde.",
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
      "Muitas tentativas de verificação. Tente novamente mais tarde.",
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

  if (!code) {
    registerAuthFailure(
      accountKey,
      RATE_WINDOW_MS,
    )
    registerAuthFailure(
      ipKey,
      RATE_WINDOW_MS,
    )

    return jsonError(
      "Informe o código de autenticação.",
      400,
    )
  }

  try {
    let recoveryCodes:
      | string[]
      | undefined

    if (
      challenge.mode ===
      "setup"
    ) {
      const activated =
        await activateTwoFactor(
          challenge.userId,
          code,
        )

      if (!activated) {
        registerAuthFailure(
          accountKey,
          RATE_WINDOW_MS,
        )
        registerAuthFailure(
          ipKey,
          RATE_WINDOW_MS,
        )

        return jsonError(
          "Código inválido. Confira o aplicativo autenticador e tente novamente.",
          401,
        )
      }

      recoveryCodes =
        activated.recoveryCodes
    } else {
      const verified =
        await verifySecondFactor(
          challenge.userId,
          code,
        )

      if (!verified) {
        registerAuthFailure(
          accountKey,
          RATE_WINDOW_MS,
        )
        registerAuthFailure(
          ipKey,
          RATE_WINDOW_MS,
        )

        return jsonError(
          "Código de autenticação inválido ou já utilizado.",
          401,
        )
      }
    }

    const tenantContext =
      await getDefaultAdminTenantContextForUserId(
        challenge.userId,
      )

    if (!tenantContext) {
      return jsonError(
        "Não foi possível entrar nesta conta.",
        403,
      )
    }

    const allowSuperadmin =
      challenge.authSource ===
        "cpf" &&
      challenge.allowSuperadmin &&
      (await userCanReceiveSuperadminCpfSession(
        challenge.userId,
      ))

    const redirectTo =
      allowSuperadmin
        ? "/superadmin"
        : "/admin"

    await markAdminUserLoginCompleted(
      challenge.userId,
    )

    const persistentSession =
      await createAdminSessionRecord({
        userId:
          challenge.userId,
        organizationId:
          tenantContext.organizationId,
        sessionVersion:
          tenantContext.sessionVersion,
        authSource:
          challenge.authSource,
        superadminAuthorized:
          allowSuperadmin,
        request,
      })

    clearAuthFailures(
      accountKey,
    )
    clearAuthFailures(
      ipKey,
    )

    const response =
      NextResponse.json({
        ok: true,
        redirectTo,
        ...(recoveryCodes
          ? {
              recoveryCodes,
            }
          : {}),
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      createSessionToken(
        tenantContext,
        persistentSession.id,
      ),
      sessionCookieOptions(),
    )

    response.cookies.set(
      LEGACY_ADMIN_SESSION_COOKIE,
      "",
      clearCookieOptions(),
    )

    if (allowSuperadmin) {
      response.cookies.set(
        SUPERADMIN_SESSION_COOKIE,
        createSuperadminSessionToken(
          challenge.userId,
          persistentSession.id,
        ),
        sessionCookieOptions(),
      )
    } else {
      response.cookies.set(
        SUPERADMIN_SESSION_COOKIE,
        "",
        clearCookieOptions(),
      )
    }

    response.cookies.set(
      TWO_FACTOR_CHALLENGE_COOKIE,
      "",
      clearTwoFactorChallengeCookieOptions(),
    )

    return response
  } catch (error) {
    console.error(
      "[SaborFlow 2FA] Falha ao validar segundo fator:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Não foi possível validar o 2FA no momento.",
      503,
    )
  }
}