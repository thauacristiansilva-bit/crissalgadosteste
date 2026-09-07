import {
  cookies,
} from "next/headers"
import {
  NextResponse,
} from "next/server"
import {
  requestIsSameOrigin,
} from "@/lib/security/request-security"
import {
  createPasskeyAuthenticationOptions,
  getWebAuthnRequestConfig,
  userHasPasskeys,
} from "@/lib/security/passkeys"
import {
  PASSKEY_CHALLENGE_COOKIE,
  createPasskeyChallenge,
  passkeyChallengeCookieOptions,
  passkeyParentChallengeHash,
} from "@/lib/security/passkey-challenge"
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  parseTwoFactorChallenge,
} from "@/lib/security/two-factor-challenge"

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

async function currentTwoFactorChallenge() {
  const store =
    await cookies()

  const token =
    store.get(
      TWO_FACTOR_CHALLENGE_COOKIE,
    )?.value || ""

  return {
    token,
    challenge:
      parseTwoFactorChallenge(
        token,
      ),
  }
}

export async function GET() {
  const current =
    await currentTwoFactorChallenge()

  const challenge =
    current.challenge

  if (
    !challenge ||
    challenge.mode !==
      "verify"
  ) {
    const response =
      NextResponse.json({
        ok: true,
        available: false,
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    return response
  }

  try {
    const available =
      await userHasPasskeys(
        challenge.userId,
      )

    const response =
      NextResponse.json({
        ok: true,
        available,
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    return response
  } catch {
    return jsonError(
      "Não foi possível consultar Passkeys.",
      503,
    )
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

  const current =
    await currentTwoFactorChallenge()

  const challenge =
    current.challenge

  if (
    !challenge ||
    challenge.mode !==
      "verify" ||
    !current.token
  ) {
    return jsonError(
      "Sua verificação expirou. Entre novamente.",
      401,
    )
  }

  try {
    const config =
      getWebAuthnRequestConfig(
        request,
      )

    const options =
      await createPasskeyAuthenticationOptions({
        userId:
          challenge.userId,
        rpID:
          config.rpID,
      })

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
          "authentication",
        userId:
          challenge.userId,
        challenge:
          options.challenge,
        rpID:
          config.rpID,
        expectedOrigin:
          config.expectedOrigin,
        parentChallengeHash:
          passkeyParentChallengeHash(
            current.token,
          ),
      }),
      passkeyChallengeCookieOptions(),
    )

    return response
  } catch (error) {
    console.error(
      "[SaborFlow Passkeys] Falha ao iniciar autenticação:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Nenhuma Passkey disponível ou não foi possível iniciar a autenticação.",
      400,
    )
  }
}
