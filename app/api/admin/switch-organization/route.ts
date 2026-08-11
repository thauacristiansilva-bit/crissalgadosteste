import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
} from "@/lib/auth"
import {
  getOrganizationContextForUser,
} from "@/lib/tenant-context"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"

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
    createSessionToken(context),
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge:
        60 * 60 * 24 * 7,
    },
  )

  return response
}
