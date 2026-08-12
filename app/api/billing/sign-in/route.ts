import { NextResponse } from "next/server"
import { authenticateAdminUser } from "@/lib/admin-user-db"
import {
  BILLING_SESSION_COOKIE,
  commercialBillingCookieOptions,
  createCommercialBillingSessionToken,
} from "@/lib/billing-commercial-session"
import { getBillingAccountForUser } from "@/lib/billing-contracting"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null
  if (!body?.email || !body.password) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 })
  }
  const user = await authenticateAdminUser(body.email.trim(), body.password)
  if (!user) return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 })
  const account = await getBillingAccountForUser(user.id)
  if (!account) {
    return NextResponse.json({ error: "Esta conta ainda não possui cadastro comercial." }, { status: 403 })
  }
  const response = NextResponse.json({ ok: true, email: user.email })
  response.cookies.set(
    BILLING_SESSION_COOKIE,
    createCommercialBillingSessionToken({
      userId: user.id,
      billingAccountId: account.id,
      email: user.email,
    }),
    commercialBillingCookieOptions,
  )
  return response
}
