import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  createSessionToken,
} from "@/lib/auth"
import { getCommercialBillingSession } from "@/lib/billing-commercial-session"
import { createDemoEnvironment } from "@/lib/demo-db"
import { PUBLIC_TENANT_COOKIE } from "@/lib/public-tenant"
import { requestIsSameOrigin } from "@/lib/demo-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 })
  }

  const commercialSession = await getCommercialBillingSession()
  if (!commercialSession) {
    return NextResponse.json({
      error: "Entre ou crie sua conta comercial antes de iniciar o trial individual.",
      signInUrl: "/contratar",
    }, { status: 401 })
  }

  try {
    const demo = await createDemoEnvironment({
      kind: "trial",
      requestedByUserId: commercialSession.userId,
    })
    const remainingSeconds = Math.max(60, Math.floor((new Date(demo.expiresAt).getTime() - Date.now()) / 1000))
    const response = NextResponse.json({
      ok: true,
      kind: demo.kind,
      reused: demo.reused,
      expiresAt: demo.expiresAt,
      redirectTo: "/admin?trial=1",
      storeUrl: `/loja/${encodeURIComponent(demo.organization.slug)}`,
    })

    response.cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(demo.tenantContext), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: remainingSeconds,
    })
    response.cookies.set(LEGACY_ADMIN_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    })
    response.cookies.set(PUBLIC_TENANT_COOKIE, demo.organization.slug, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: remainingSeconds,
    })
    return response
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível iniciar o trial.",
    }, { status: 503 })
  }
}
