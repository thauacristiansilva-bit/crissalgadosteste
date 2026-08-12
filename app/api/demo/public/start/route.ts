import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  createSessionToken,
} from "@/lib/auth"
import { createDemoEnvironment } from "@/lib/demo-db"
import { PUBLIC_TENANT_COOKIE } from "@/lib/public-tenant"
import { demoRequestFingerprint, requestIsSameOrigin } from "@/lib/demo-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 })
  }

  try {
    const demo = await createDemoEnvironment({
      kind: "public",
      requestFingerprint: demoRequestFingerprint(request),
    })
    const remainingSeconds = Math.max(60, Math.floor((new Date(demo.expiresAt).getTime() - Date.now()) / 1000))
    const response = NextResponse.json({
      ok: true,
      kind: demo.kind,
      expiresAt: demo.expiresAt,
      redirectTo: "/admin?demo=1",
      storeUrl: `/loja/${encodeURIComponent(demo.organization.slug)}`,
    }, { status: 201 })

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
      error: error instanceof Error ? error.message : "Não foi possível iniciar a demonstração.",
    }, { status: 503 })
  }
}
