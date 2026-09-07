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
  deleteUserPasskey,
  listUserPasskeys,
} from "@/lib/security/passkeys"
import {
  verifySecondFactor,
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

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return jsonError(
      "Sessão administrativa inválida.",
      401,
    )
  }

  try {
    const passkeys =
      await listUserPasskeys(
        session.userId,
      )

    const response =
      NextResponse.json({
        ok: true,
        passkeys,
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    return response
  } catch (error) {
    console.error(
      "[SaborFlow Passkeys] Falha ao listar Passkeys:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Não foi possível carregar as Passkeys.",
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

  const accountKey =
    authRateLimitKey(
      "account",
      `passkey-delete:${session.userId}`,
    )

  const ipKey =
    authRateLimitKey(
      "ip",
      `passkey-delete:${requestIp(request)}`,
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
          credentialId?: string
          code?: string
        }
      | null

  const credentialId =
    body?.credentialId?.trim() ||
    ""

  const code =
    body?.code?.trim() || ""

  if (
    !credentialId ||
    !code
  ) {
    registerAuthFailure(
      accountKey,
      RATE_WINDOW_MS,
    )
    registerAuthFailure(
      ipKey,
      RATE_WINDOW_MS,
    )

    return jsonError(
      "Informe a Passkey e confirme sua identidade.",
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
      registerAuthFailure(
        accountKey,
        RATE_WINDOW_MS,
      )
      registerAuthFailure(
        ipKey,
        RATE_WINDOW_MS,
      )

      return jsonError(
        "Código atual inválido ou já utilizado.",
        401,
      )
    }

    const removed =
      await deleteUserPasskey(
        session.userId,
        credentialId,
      )

    if (!removed) {
      return jsonError(
        "Passkey não encontrada.",
        404,
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
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    return response
  } catch (error) {
    console.error(
      "[SaborFlow Passkeys] Falha ao remover Passkey:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Não foi possível remover a Passkey.",
      503,
    )
  }
}
