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
  getWebAuthnRequestConfig,
  verifyPasskeyAuthentication,
} from "@/lib/security/passkeys"
import {
  PASSKEY_CHALLENGE_COOKIE,
  clearPasskeyChallengeCookieOptions,
  parsePasskeyChallenge,
  passkeyParentChallengeHash,
} from "@/lib/security/passkey-challenge"
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  clearTwoFactorChallengeCookieOptions,
  parseTwoFactorChallenge,
} from "@/lib/security/two-factor-challenge"
import {
  markAdminUserLoginCompleted,
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

  const twoFactorToken =
    store.get(
      TWO_FACTOR_CHALLENGE_COOKIE,
    )?.value || ""

  const twoFactorChallenge =
    parseTwoFactorChallenge(
      twoFactorToken,
    )

  const passkeyChallenge =
    parsePasskeyChallenge(
      store.get(
        PASSKEY_CHALLENGE_COOKIE,
      )?.value,
    )

  if (
    !twoFactorChallenge ||
    twoFactorChallenge.mode !==
      "verify" ||
    !passkeyChallenge ||
    passkeyChallenge.purpose !==
      "authentication" ||
    passkeyChallenge.userId !==
      twoFactorChallenge.userId ||
    !twoFactorToken ||
    !passkeyChallenge.parentChallengeHash ||
    passkeyChallenge.parentChallengeHash !==
      passkeyParentChallengeHash(
        twoFactorToken,
      )
  ) {
    return jsonError(
      "Sua verificação com Passkey expirou. Entre novamente.",
      401,
    )
  }

  const accountKey =
    authRateLimitKey(
      "account",
      `passkey-auth:${twoFactorChallenge.userId}`,
    )

  const ipKey =
    authRateLimitKey(
      "ip",
      `passkey-auth:${requestIp(request)}`,
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
          response?: unknown
        }
      | null

  if (!body?.response) {
    registerAuthFailure(
      accountKey,
      RATE_WINDOW_MS,
    )
    registerAuthFailure(
      ipKey,
      RATE_WINDOW_MS,
    )

    return jsonError(
      "Resposta da Passkey ausente.",
      400,
    )
  }

  try {
    const currentConfig =
      getWebAuthnRequestConfig(
        request,
      )

    if (
      currentConfig.rpID !==
        passkeyChallenge.rpID ||
      currentConfig.expectedOrigin !==
        passkeyChallenge.expectedOrigin
    ) {
      return jsonError(
        "A origem da Passkey mudou durante a autenticação.",
        403,
      )
    }

    const verified =
      await verifyPasskeyAuthentication({
        userId:
          twoFactorChallenge.userId,
        response:
          body.response as Parameters<
            typeof verifyPasskeyAuthentication
          >[0]["response"],
        expectedChallenge:
          passkeyChallenge.challenge,
        expectedOrigin:
          passkeyChallenge.expectedOrigin,
        expectedRPID:
          passkeyChallenge.rpID,
      })

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
        "Passkey inválida para esta conta.",
        401,
      )
    }

    const tenantContext =
      await getDefaultAdminTenantContextForUserId(
        twoFactorChallenge.userId,
      )

    if (!tenantContext) {
      return jsonError(
        "Não foi possível entrar nesta conta.",
        403,
      )
    }

    const allowSuperadmin =
      twoFactorChallenge.authSource ===
        "cpf" &&
      twoFactorChallenge.allowSuperadmin &&
      (await userCanReceiveSuperadminCpfSession(
        twoFactorChallenge.userId,
      ))

    const redirectTo =
      allowSuperadmin
        ? "/superadmin"
        : "/admin"

    await markAdminUserLoginCompleted(
      twoFactorChallenge.userId,
    )

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
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      createSessionToken(
        tenantContext,
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
          twoFactorChallenge.userId,
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

    response.cookies.set(
      PASSKEY_CHALLENGE_COOKIE,
      "",
      clearPasskeyChallengeCookieOptions(),
    )

    return response
  } catch (error) {
    registerAuthFailure(
      accountKey,
      RATE_WINDOW_MS,
    )
    registerAuthFailure(
      ipKey,
      RATE_WINDOW_MS,
    )

    console.error(
      "[SaborFlow Passkeys] Falha ao validar Passkey:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Não foi possível validar a Passkey.",
      401,
    )
  }
}
