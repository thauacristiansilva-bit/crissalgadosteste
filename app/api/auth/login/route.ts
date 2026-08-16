import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  createSessionToken,
} from "@/lib/auth"
import {
  authenticateAdminUser,
  getAdminUserCredentialState,
} from "@/lib/admin-user-db"
import {
  getDefaultAdminTenantContextForUserId,
} from "@/lib/tenant-context"

function setSessionCookies(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })

  // Limpeza definitiva de cookie pré-Fase 25.
  response.cookies.set(LEGACY_ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null

  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "E-mail ou senha inválidos." },
      { status: 401 },
    )
  }

  const email = body.email.trim()
  const password = body.password

  try {
    const credentialState = await getAdminUserCredentialState(email)

    if (!credentialState?.active || !credentialState.passwordReady) {
      return NextResponse.json(
        {
          error:
            "Login PostgreSQL não está preparado para esta conta. O login legado foi desativado.",
        },
        { status: 503 },
      )
    }

    const user = await authenticateAdminUser(email, password)
    if (!user) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 },
      )
    }

    const tenantContext =
      await getDefaultAdminTenantContextForUserId(user.id)

    if (!tenantContext) {
      return NextResponse.json(
        { error: "Sua conta não possui uma empresa ativa." },
        { status: 403 },
      )
    }

    const response = NextResponse.json({
      ok: true,
      sessionMode: "tenant",
      authSource: "postgres",
    })

    setSessionCookies(response, createSessionToken(tenantContext))
    return response
  } catch (error) {
    console.error(
      "[SaborFlow] Falha no login PostgreSQL:",
      error instanceof Error ? error.message : error,
    )

    return NextResponse.json(
      { error: "Não foi possível validar o login no PostgreSQL." },
      { status: 503 },
    )
  }
}
