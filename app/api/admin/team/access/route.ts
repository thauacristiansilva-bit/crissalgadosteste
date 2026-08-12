import { NextResponse } from "next/server"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageTeam,
} from "@/lib/tenant-permissions"
import {
  createTeamInvitation,
  createTeamPasswordReset,
  disableTeamAccess,
  listTeamAccess,
} from "@/lib/team-access-db"

export const dynamic = "force-dynamic"

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canManageTeam(session.role)
  ) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: session ? 403 : 401 },
    )
  }

  return NextResponse.json({
    access:
      await listTeamAccess(
        session.organizationId,
      ),
  })
}

export async function POST(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canManageTeam(session.role)
  ) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: session ? 403 : 401 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        action?:
          | "invite"
          | "password-reset"
        staffMemberId?: number
        userId?: string
      }
    | null

  const origin =
    new URL(request.url).origin

  try {
    if (
      body?.action ===
      "password-reset"
    ) {
      if (!body.userId) {
        throw new Error(
          "Usuário inválido.",
        )
      }

      const reset =
        await createTeamPasswordReset({
          organizationId:
            session.organizationId,
          targetUserId:
            body.userId,
          createdByUserId:
            session.userId,
          actorRole:
            session.role,
        })

      return NextResponse.json({
        reset: {
          email:
            reset.email,
          expiresAt:
            reset.expiresAt,
          url:
            `${origin}/recuperar-senha/${encodeURIComponent(
              reset.token,
            )}`,
        },
      })
    }

    const staffMemberId =
      Number(
        body?.staffMemberId,
      )

    if (
      !Number.isInteger(
        staffMemberId,
      ) ||
      staffMemberId <= 0
    ) {
      throw new Error(
        "Colaborador inválido.",
      )
    }

    const invitation =
      await createTeamInvitation({
        organizationId:
          session.organizationId,
        staffMemberId,
        invitedByUserId:
          session.userId,
      })

    return NextResponse.json({
      invitation: {
        ...invitation,
        url:
          invitation.token
            ? `${origin}/convite/${encodeURIComponent(
                invitation.token,
              )}`
            : null,
        token: undefined,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o acesso.",
      },
      { status: 400 },
    )
  }
}

export async function DELETE(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canManageTeam(session.role)
  ) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: session ? 403 : 401 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | { userId?: string }
    | null

  if (!body?.userId) {
    return NextResponse.json(
      { error: "Usuário inválido." },
      { status: 400 },
    )
  }

  try {
    await disableTeamAccess(
      session.organizationId,
      body.userId,
    )

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível desativar o acesso.",
      },
      { status: 400 },
    )
  }
}
