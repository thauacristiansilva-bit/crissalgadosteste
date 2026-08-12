import { NextResponse } from "next/server"
import {
  acceptTeamInvitation,
  getInvitationPreview,
} from "@/lib/team-access-db"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      token: string
    }>
  },
) {
  const { token } =
    await context.params

  const preview =
    await getInvitationPreview(
      decodeURIComponent(token),
    )

  if (!preview) {
    return NextResponse.json(
      {
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
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      token: string
    }>
  },
) {
  const { token } =
    await context.params

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
            decodeURIComponent(
              token,
            ),
            body?.password,
          ),
      },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível aceitar o convite.",
      },
      { status: 400 },
    )
  }
}
