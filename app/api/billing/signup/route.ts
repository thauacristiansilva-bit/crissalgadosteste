import { NextResponse } from "next/server"
import {
  BILLING_SESSION_COOKIE,
  commercialBillingCookieOptions,
  createCommercialBillingSessionToken,
} from "@/lib/billing-commercial-session"
import { registerCommercialUser } from "@/lib/billing-contracting"
import { authRateLimitKey, checkAuthRateLimit, registerAuthFailure } from "@/lib/security/rate-limit"
import { requestIp } from "@/lib/security/request-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SIGNUP_LIMIT = 8
const SIGNUP_WINDOW_MS = 60 * 60 * 1000

export async function POST(request: Request) {
  const signupKey = authRateLimitKey("ip", `billing-signup:${requestIp(request)}`)
  const signupState = checkAuthRateLimit(signupKey, SIGNUP_LIMIT, SIGNUP_WINDOW_MS)
  if (!signupState.allowed) {
    const response = NextResponse.json(
      { error: "Muitas tentativas de cadastro. Tente novamente mais tarde." },
      { status: 429 },
    )
    response.headers.set("Retry-After", String(signupState.retryAfterSeconds))
    return response
  }
  registerAuthFailure(signupKey, SIGNUP_WINDOW_MS)

  const body = await request.json().catch(() => null) as {
    name?: string
    email?: string
    password?: string
    cpf?: string
    hasCnpj?: boolean
    cnpj?: string
    legalAccepted?: boolean
  } | null
  if (!body?.name || !body.email || !body.password || !body.cpf) {
    return NextResponse.json({ error: "Nome, e-mail, senha e CPF do responsável são obrigatórios." }, { status: 400 })
  }
  if (body.legalAccepted !== true) {
    return NextResponse.json({ error: "Leia e aceite os Termos de Uso e o Aviso de Privacidade para criar a conta." }, { status: 400 })
  }
  try {
    const account = await registerCommercialUser({
      name: body.name,
      email: body.email,
      password: body.password,
      cpf: body.cpf,
      hasCnpj: Boolean(body.hasCnpj),
      cnpj: body.cnpj || "",
      legalAccepted: true,
      ipAddress: requestIp(request),
      userAgent: request.headers.get("user-agent") || "",
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
