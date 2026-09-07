import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_IDLE_SECONDS,
  createSessionToken,
} from "@/lib/auth"
import {
  getOrganizationContextForUser,
} from "@/lib/tenant-context"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  moveAdminSessionToOrganization,
} from "@/lib/security/admin-sessions"

export async function POST(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Não autorizado.",
      },
      { status: 401 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        organizationId?: string
      }
    | null

  if (!body?.organizationId) {
    return NextResponse.json(
      {
        error:
          "Empresa inválida.",
      },
      { status: 400 },
    )
  }

  const context =
    await getOrganizationContextForUser(
      session.userId,
      body.organizationId,
    )

  if (!context) {
    return NextResponse.json(
      {
        error:
          "Você não possui acesso a esta empresa.",
      },
      { status: 403 },
    )
  }

  const moved =
    await moveAdminSessionToOrganization({
      sessionId:
        session.sessionId,
      userId:
        session.userId,
      organizationId:
        context.organizationId,
      sessionVersion:
        context.sessionVersion,
    })

  if (!moved) {
    return NextResponse.json(
      {
        error:
          "Sua sessão expirou. Entre novamente.",
      },
      { status: 401 },
    )
  }

  const response =
    NextResponse.json({
      ok: true,
      organization: {
        id: context.organizationId,
        name:
          context.organizationName,
        slug:
          context.organizationSlug,
        role: context.role,
      },
    })

  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    createSessionToken(
      context,
      session.sessionId,
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge:
        ADMIN_SESSION_IDLE_SECONDS,
      priority: "high",
    },
  )

  return response
}
