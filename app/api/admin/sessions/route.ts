import {
  NextResponse,
} from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  SUPERADMIN_SESSION_COOKIE,
} from "@/lib/auth"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  listAdminSessions,
  revokeAdminSession,
  revokeOtherAdminSessions,
} from "@/lib/security/admin-sessions"
import {
  requestIsSameOrigin,
} from "@/lib/security/request-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function noStore(
  body: Record<string, unknown>,
  status = 200,
) {
  const response =
    NextResponse.json(
      body,
      { status },
    )

  response.headers.set(
    "Cache-Control",
    "no-store",
  )

  return response
}

function clearSessionCookies(
  response: NextResponse,
) {
  for (const cookieName of [
    ADMIN_SESSION_COOKIE,
    SUPERADMIN_SESSION_COOKIE,
    LEGACY_ADMIN_SESSION_COOKIE,
  ]) {
    response.cookies.set(
      cookieName,
      "",
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge: 0,
      },
    )
  }
}

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return noStore(
      {
        error:
          "Sessão administrativa inválida.",
      },
      401,
    )
  }

  const sessions =
    await listAdminSessions(
      session.userId,
      session.sessionId,
    )

  return noStore({
    sessions,
    idleDays: 10,
  })
}

export async function POST(
  request: Request,
) {
  if (
    !requestIsSameOrigin(
      request,
    )
  ) {
    return noStore(
      {
        error:
          "Origem da requisição não autorizada.",
      },
      403,
    )
  }

  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return noStore(
      {
        error:
          "Sessão administrativa inválida.",
      },
      401,
    )
  }

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          action?: string
        }
      | null

  if (
    body?.action !==
    "revoke_others"
  ) {
    return noStore(
      {
        error:
          "Ação de sessão inválida.",
      },
      400,
    )
  }

  const revoked =
    await revokeOtherAdminSessions(
      session.userId,
      session.sessionId,
    )

  return noStore({
    ok: true,
    revoked,
  })
}

export async function DELETE(
  request: Request,
) {
  if (
    !requestIsSameOrigin(
      request,
    )
  ) {
    return noStore(
      {
        error:
          "Origem da requisição não autorizada.",
      },
      403,
    )
  }

  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return noStore(
      {
        error:
          "Sessão administrativa inválida.",
      },
      401,
    )
  }

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          sessionId?: string
        }
      | null

  const sessionId =
    body?.sessionId?.trim() || ""

  if (!sessionId) {
    return noStore(
      {
        error:
          "Sessão não informada.",
      },
      400,
    )
  }

  const revoked =
    await revokeAdminSession({
      sessionId,
      userId:
        session.userId,
      reason:
        "user_revoked",
    })

  if (!revoked) {
    return noStore(
      {
        error:
          "Sessão não encontrada.",
      },
      404,
    )
  }

  const currentRevoked =
    sessionId ===
    session.sessionId

  const response =
    noStore({
      ok: true,
      currentRevoked,
    })

  if (currentRevoked) {
    clearSessionCookies(
      response,
    )
  }

  return response
}
