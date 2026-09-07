import {
  cookies,
} from "next/headers"
import {
  NextResponse,
} from "next/server"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  requestIsSameOrigin,
} from "@/lib/security/request-security"
import {
  getWebAuthnRequestConfig,
  verifyAndStorePasskeyRegistration,
} from "@/lib/security/passkeys"
import {
  PASSKEY_CHALLENGE_COOKIE,
  clearPasskeyChallengeCookieOptions,
  parsePasskeyChallenge,
} from "@/lib/security/passkey-challenge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function jsonError(
  message: string,
  status: number,
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

  const store =
    await cookies()

  const challenge =
    parsePasskeyChallenge(
      store.get(
        PASSKEY_CHALLENGE_COOKIE,
      )?.value,
    )

  if (
    !challenge ||
    challenge.purpose !==
      "registration" ||
    challenge.userId !==
      session.userId ||
    !challenge.name
  ) {
    return jsonError(
      "O cadastro da Passkey expirou. Inicie novamente.",
      401,
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
        challenge.rpID ||
      currentConfig.expectedOrigin !==
        challenge.expectedOrigin
    ) {
      return jsonError(
        "A origem da Passkey mudou durante o cadastro.",
        403,
      )
    }

    const passkey =
      await verifyAndStorePasskeyRegistration({
        userId:
          session.userId,
        name:
          challenge.name,
        response:
          body.response as Parameters<
            typeof verifyAndStorePasskeyRegistration
          >[0]["response"],
        expectedChallenge:
          challenge.challenge,
        expectedOrigin:
          challenge.expectedOrigin,
        expectedRPID:
          challenge.rpID,
      })

    if (!passkey) {
      return jsonError(
        "Não foi possível validar a nova Passkey.",
        401,
      )
    }

    const response =
      NextResponse.json({
        ok: true,
        passkey,
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    response.cookies.set(
      PASSKEY_CHALLENGE_COOKIE,
      "",
      clearPasskeyChallengeCookieOptions(),
    )

    return response
  } catch (error) {
    console.error(
      "[SaborFlow Passkeys] Falha ao confirmar cadastro:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Não foi possível confirmar a Passkey.",
      400,
    )
  }
}
