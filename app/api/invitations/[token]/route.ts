import { NextResponse } from "next/server"
import {
  acceptTeamInvitation,
  getInvitationPreview,
} from "@/lib/team-access-db"

export const dynamic = "force-dynamic"

function invitationToken(raw: string) {
  try {
    return decodeURIComponent(raw).trim()
  } catch {
    return ""
  }
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      token: string
    }>
  },
) {
  const { token: rawToken } =
    await context.params
  const token = invitationToken(rawToken)

  if (!token) {
    return NextResponse.json(
      {
        code: "invite_invalid",
        error:
          "Convite inválido ou expirado.",
      },
      { status: 404 },
    )
  }

  try {
    const preview =
      await getInvitationPreview(token)

    if (!preview) {
      return NextResponse.json(
        {
          code: "invite_invalid",
          error:
            "Convite inválido ou expirado.",
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      invitation: {
        name: preview.name,
        email: preview.email,
        role: preview.role,
        organizationName:
          preview.organizationName,
        organizationSlug:
          preview.organizationSlug,
        passwordRequired:
          !preview.passwordReady,
        expiresAt:
          preview.expiresAt,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        code: "invite_validation_unavailable",
        error:
          "Não foi possível validar o convite agora. Tente novamente em instantes.",
        detail:
          process.env.NODE_ENV === "development" &&
          error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 503 },
    )
  }
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      token: string
    }>
  },
) {
  const { token: rawToken } =
    await context.params
  const token = invitationToken(rawToken)

  if (!token) {
    return NextResponse.json(
      {
        code: "invite_invalid",
        error:
          "Convite inválido ou expirado.",
      },
      { status: 404 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | { password?: string }
    | null

  try {
    return NextResponse.json(
      {
        ok: true,
        result:
          await acceptTeamInvitation(
            token,
            body?.password,
          ),
      },
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível aceitar o convite."
    const invalid =
      /convite.*(inválido|expirado|usado|pendente)/i.test(
        message,
      )

    return NextResponse.json(
      {
        code: invalid
          ? "invite_invalid"
          : "invite_accept_failed",
        error: message,
      },
      { status: invalid ? 409 : 400 },
    )
  }
}
