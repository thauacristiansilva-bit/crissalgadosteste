import { NextResponse } from "next/server"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  getTwoFactorState,
} from "@/lib/security/two-factor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Sessão administrativa inválida.",
      },
      { status: 401 },
    )
  }

  try {
    const state =
      await getTwoFactorState(
        session.userId,
      )

    const response =
      NextResponse.json({
        ok: true,
        ...state,
      })

    response.headers.set(
      "Cache-Control",
      "no-store",
    )

    return response
  } catch (error) {
    console.error(
      "[SaborFlow 2FA] Falha ao carregar segurança do 2FA:",
      error instanceof Error
        ? error.message
        : error,
    )

    return NextResponse.json(
      {
        error:
          "Não foi possível carregar a segurança do 2FA.",
      },
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
