import {
  cookies,
} from "next/headers"
import {
  NextResponse,
} from "next/server"
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  parseTwoFactorChallenge,
} from "@/lib/security/two-factor-challenge"
import {
  ensureTwoFactorEnrollment,
} from "@/lib/security/two-factor"

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

export async function GET() {
  try {
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

    if (
      challenge.mode !==
      "setup"
    ) {
      return jsonError(
        "O 2FA já está configurado para esta conta.",
        409,
      )
    }

    const setup =
      await ensureTwoFactorEnrollment(
        challenge.userId,
        challenge.email,
      )

    const response =
      NextResponse.json({
        ok: true,
        issuer: "SaborFlow",
        account:
          challenge.email,
        manualKey:
          setup.manualKey,
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    return response
  } catch (error) {
    console.error(
      "[SaborFlow 2FA] Falha ao preparar configuração:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonError(
      "Não foi possível preparar o 2FA no momento.",
      503,
    )
  }
}
