import { NextResponse } from "next/server"
import { resolvePublicAppOrigin } from "@/lib/public-origin"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageAccess,
  canManageTeam,
  canViewTeam,
} from "@/lib/tenant-permissions"
import {
  createTeamInvitation,
  createTeamPasswordReset,
  disableTeamAccess,
  listTeamAccess,
} from "@/lib/team-access-db"
import { assertCanAddUser, billingErrorStatus } from "@/lib/billing-db"

export const dynamic = "force-dynamic"

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canViewTeam(session.role)
  ) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: session ? 403 : 401 },
    )
  }

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () =>
      NextResponse.json({
        access:
          await listTeamAccess(
            session.organizationId,
          ),
      }),
    "tenant-session",
  )
}

export async function POST(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canManageAccess(session.role)
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

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () => {
      try {
        const origin = resolvePublicAppOrigin(request)

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

        const currentAccess = await listTeamAccess(session.organizationId)
        const targetAccess = currentAccess.find((item) => item.staffMemberId === staffMemberId)
        if (!targetAccess || !["active", "invited"].includes(String(targetAccess.membershipStatus))) {
          await assertCanAddUser(session.organizationId)
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
          { status: billingErrorStatus(error) },
        )
      }
    },
    "tenant-session",
  )
}

export async function DELETE(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canManageAccess(session.role)
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

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () => {
      try {
        await disableTeamAccess(
          session.organizationId,
          body.userId!,
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
    },
    "tenant-session",
  )
}
