import { NextResponse } from "next/server"
import {
  BILLING_SESSION_COOKIE,
  commercialBillingCookieOptions,
  createCommercialBillingSessionToken,
} from "@/lib/billing-commercial-session"
import { registerCommercialUser } from "@/lib/billing-contracting"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    name?: string
    email?: string
    password?: string
  } | null
  if (!body?.name || !body.email || !body.password) {
    return NextResponse.json({ error: "Nome, e-mail e senha são obrigatórios." }, { status: 400 })
  }
  try {
    const account = await registerCommercialUser({
      name: body.name,
      email: body.email,
      password: body.password,
    })
    const response = NextResponse.json({ ok: true, email: account.email }, { status: 201 })
    response.cookies.set(
      BILLING_SESSION_COOKIE,
      createCommercialBillingSessionToken(account),
      commercialBillingCookieOptions,
    )
    return response
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível criar a conta.",
    }, { status: 400 })
  }
}
