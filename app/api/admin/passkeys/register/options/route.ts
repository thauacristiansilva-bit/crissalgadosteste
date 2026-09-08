import {
  NextResponse,
} from "next/server"
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
  createPasskeyRegistrationOptions,
  getWebAuthnRequestConfig,
} from "@/lib/security/passkeys"
import {
  verifySecondFactor,
} from "@/lib/security/two-factor"
import {
  PASSKEY_CHALLENGE_COOKIE,
  createPasskeyChallenge,
  passkeyChallengeCookieOptions,
} from "@/lib/security/passkey-challenge"

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
      `passkey-register:${session.userId}`,
    )

  const ipKey =
    authRateLimitKey(
      "ip",
      `passkey-register:${requestIp(request)}`,
    )

  const accountState =
    await checkAuthRateLimit(
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
    await checkAuthRateLimit(
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
          name?: string
          code?: string
        }
      | null

  const name =
    body?.name
      ?.trim()
      .replace(
        /\s+/g,
        " ",
      ) || ""

  const code =
    body?.code?.trim() || ""

  if (
    name.length < 2 ||
    name.length > 80 ||
    !code
  ) {
    await registerAuthFailure(
      accountKey,
      RATE_WINDOW_MS,
    )
    await registerAuthFailure(
      ipKey,
      RATE_WINDOW_MS,
    )

    return jsonError(
      "Informe um nome válido e confirme com o Authenticator ou um código de recuperação.",
      400,
    )
  }

  try {
    const verified =
      await verifySecondFactor(
        session.userId,
        code,
      )

    if (!verified) {
      await registerAuthFailure(
        accountKey,
        RATE_WINDOW_MS,
      )
      await registerAuthFailure(
        ipKey,
        RATE_WINDOW_MS,
      )

      return jsonError(
        "Código atual inválido ou já utilizado.",
        401,
      )
    }

    const config =
      getWebAuthnRequestConfig(
        request,
      )

    const options =
      await createPasskeyRegistrationOptions({
        userId:
          session.userId,
        email:
          session.email,
        rpID:
          config.rpID,
      })

    await clearAuthFailures(
      accountKey,
    )
    await clearAuthFailures(
      ipKey,
    )

    const response =
      NextResponse.json({
        ok: true,
        options,
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    response.cookies.set(
      PASSKEY_CHALLENGE_COOKIE,
      createPasskeyChallenge({
        purpose:
          "registration",
        userId:
          session.userId,
        challenge:
          options.challenge,
        rpID:
          config.rpID,
        expectedOrigin:
          config.expectedOrigin,
        name,
      }),
      passkeyChallengeCookieOptions(),
    )

    return response
  } catch (error) {
    console.error(
      "[SaborFlow Passkeys] Falha ao iniciar cadastro:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      error instanceof Error &&
        error.message.includes(
          "limite de 10",
        )
        ? error.message
        : "Não foi possível preparar a Passkey.",
      error instanceof Error &&
        error.message.includes(
          "limite de 10",
        )
        ? 400
        : 503,
    )
  }
}
