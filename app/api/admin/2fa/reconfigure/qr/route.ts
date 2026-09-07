import QRCode from "qrcode"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  getPendingTwoFactorReconfiguration,
} from "@/lib/security/two-factor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return new Response(
      "Sessão administrativa inválida.",
      {
        status: 401,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    )
  }

  try {
    const pending =
      await getPendingTwoFactorReconfiguration(
        session.userId,
        session.email,
      )

    if (!pending) {
      return new Response(
        "Nenhuma troca de autenticador válida está pendente.",
        {
          status: 404,
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      )
    }

    const png =
      await QRCode.toBuffer(
        pending.otpAuthUrl,
        {
          type: "png",
          width: 280,
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
            "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      },
    )
  } catch (error) {
    console.error(
      "[SaborFlow 2FA] Falha ao gerar QR de reconfiguração:",
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
