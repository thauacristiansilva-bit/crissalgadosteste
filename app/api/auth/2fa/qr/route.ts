import {
  cookies,
} from "next/headers"
import * as QRCode from "qrcode"
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  parseTwoFactorChallenge,
} from "@/lib/security/two-factor-challenge"
import {
  ensureTwoFactorEnrollment,
} from "@/lib/security/two-factor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

    if (
      !challenge ||
      challenge.mode !== "setup"
    ) {
      return new Response(
        "Verificação inválida.",
        {
          status: 401,
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      )
    }

    const setup =
      await ensureTwoFactorEnrollment(
        challenge.userId,
        challenge.email,
      )

    const png =
      await QRCode.toBuffer(
        setup.otpAuthUrl,
        {
          type: "png",
          width: 300,
          margin: 1,
          errorCorrectionLevel:
            "M",
        },
      )

    return new Response(
      new Uint8Array(png),
      {
        status: 200,
        headers: {
          "Content-Type":
            "image/png",
          "Cache-Control":
            "no-store, max-age=0",
          "X-Content-Type-Options":
            "nosniff",
        },
      },
    )
  } catch (error) {
    console.error(
      "[SaborFlow 2FA] Falha ao gerar QR Code:",
      error instanceof Error
        ? error.message
        : error,
    )

    return new Response(
      "Não foi possível gerar o QR Code.",
      {
        status: 503,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    )
  }
}
