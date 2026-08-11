import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  createSessionToken,
  credentialsAreValid,
} from "@/lib/auth"
import { getDefaultAdminTenantContext } from "@/lib/tenant-context"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null

  if (
    !body?.email ||
    !body?.password ||
    !credentialsAreValid(body.email, body.password)
  ) {
    return NextResponse.json(
      { error: "E-mail ou senha inválidos." },
      { status: 401 },
    )
  }

  let tenantContext = null

  try {
    tenantContext = await getDefaultAdminTenantContext(body.email)
  } catch (error) {
    // Durante a migração, falha no banco não pode bloquear o admin legado.
    console.error(
      "[SaborFlow] Não foi possível carregar o contexto multiempresa:",
      error instanceof Error ? error.message : error,
    )
  }

  const response = NextResponse.json({
    ok: true,
    sessionMode: tenantContext ? "tenant" : "legacy",
  })

  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    createSessionToken(tenantContext),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    },
  )

  // Remove o cookie antigo assim que o novo login for efetuado.
  response.cookies.set(LEGACY_ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })

  return response
}
