import {
  NextResponse,
} from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  SUPERADMIN_SESSION_COOKIE,
} from "@/lib/auth"
import {
  authenticateAdminUser,
} from "@/lib/admin-user-db"
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
  getTwoFactorState,
} from "@/lib/security/two-factor"
import {
  checkPersistentLoginLock,
  clearPersistentLoginFailures,
  registerPersistentLoginFailure,
} from "@/lib/security/login-lockout"
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  createTwoFactorChallenge,
  twoFactorChallengeCookieOptions,
} from "@/lib/security/two-factor-challenge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ACCOUNT_LIMIT = 8
const IP_LIMIT = 30
const RATE_WINDOW_MS =
  15 * 60 * 1000

function jsonError(
  message: string,
  status: number,
  retryAfterSeconds = 0,
) {
  const response =
    NextResponse.json(
      {
        error: message,
        ...(retryAfterSeconds > 0
          ? { retryAfterSeconds }
          : {}),
      },
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

function identifierIsCpf(
  identifier: string,
) {
  if (
    identifier.includes("@")
  ) {
    return false
  }

  return (
    identifier
      .replace(/\D/g, "")
      .length === 11
  )
}

function clearExistingSessions(
  response: NextResponse,
) {
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    "",
    clearCookieOptions(),
  )

  response.cookies.set(
    LEGACY_ADMIN_SESSION_COOKIE,
    "",
    clearCookieOptions(),
  )

  response.cookies.set(
    SUPERADMIN_SESSION_COOKIE,
    "",
    clearCookieOptions(),
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

  const ipKey =
    authRateLimitKey(
      "ip",
      requestIp(request),
    )

  const ipLimit =
    await checkAuthRateLimit(
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

  if (
    !identifier ||
    !password
  ) {
    await registerAuthFailure(
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
      .replace(
        /[.\-\s]/g,
        "",
      )

  const accountKey =
    authRateLimitKey(
      "account",
      normalizedAccountKey,
    )

  const accountLimit =
    await checkAuthRateLimit(
      accountKey,
      ACCOUNT_LIMIT,
      RATE_WINDOW_MS,
    )

  if (
    !accountLimit.allowed
  ) {
    return jsonError(
      "Muitas tentativas de login. Tente novamente mais tarde.",
      429,
      accountLimit.retryAfterSeconds,
    )
  }

  try {
    const persistentLock =
      await checkPersistentLoginLock(
        identifier,
      )

    if (persistentLock.locked) {
      return jsonError(
        "Muitas tentativas de login. Tente novamente mais tarde.",
        429,
        persistentLock.retryAfterSeconds,
      )
    }

    const user =
      await authenticateAdminUser(
        identifier,
        password,
      )

    if (!user) {
      await registerAuthFailure(
        ipKey,
        RATE_WINDOW_MS,
      )
      await registerAuthFailure(
        accountKey,
        RATE_WINDOW_MS,
      )

      const persistentFailure =
        await registerPersistentLoginFailure(
          identifier,
        )

      if (persistentFailure.locked) {
        return jsonError(
          "Muitas tentativas de login. Tente novamente mais tarde.",
          429,
          persistentFailure.retryAfterSeconds,
        )
      }

      return jsonError(
        "CPF/e-mail ou senha inválidos.",
        401,
      )
    }

    await clearPersistentLoginFailures(
      identifier,
      user.id,
    )

    await clearAuthFailures(
      accountKey,
    )
    await clearAuthFailures(
      ipKey,
    )

    const tenantContext =
      await getDefaultAdminTenantContextForUserId(
        user.id,
      )

    if (!tenantContext) {
      await registerAuthFailure(
        accountKey,
        RATE_WINDOW_MS,
      )

      return jsonError(
        "Não foi possível entrar nesta conta.",
        403,
      )
    }

    const cpfLogin =
      identifierIsCpf(
        identifier,
      )

    const allowSuperadmin =
      cpfLogin &&
      (await userCanReceiveSuperadminCpfSession(
        user.id,
      ))

    const mfa =
      await getTwoFactorState(
        user.id,
      )

    const mode =
      mfa.enabled
        ? "verify"
        : "setup"

    const response =
      NextResponse.json({
        ok: true,
        requiresTwoFactor: true,
        twoFactorMode: mode,
        authSource:
          cpfLogin
            ? "cpf"
            : "email",
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    clearExistingSessions(
      response,
    )

    response.cookies.set(
      TWO_FACTOR_CHALLENGE_COOKIE,
      createTwoFactorChallenge({
        userId: user.id,
        email: user.email,
        authSource:
          cpfLogin
            ? "cpf"
            : "email",
        allowSuperadmin,
        mode,
      }),
      twoFactorChallengeCookieOptions(),
    )

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