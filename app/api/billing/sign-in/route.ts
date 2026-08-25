import { NextResponse } from "next/server"
import { authenticateAdminUser } from "@/lib/admin-user-db"
import {
  BILLING_SESSION_COOKIE,
  commercialBillingCookieOptions,
  createCommercialBillingSessionToken,
} from "@/lib/billing-commercial-session"
import { getBillingAccountForUser } from "@/lib/billing-contracting"
import {
  authRateLimitKey,
  checkAuthRateLimit,
  clearAuthFailures,
  registerAuthFailure,
} from "@/lib/security/rate-limit"
import { requestIp, requestIsSameOrigin } from "@/lib/security/request-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ACCOUNT_LIMIT = 8
const IP_LIMIT = 30
const WINDOW_MS = 15 * 60 * 1000

function jsonError(message: string, status: number, retryAfterSeconds = 0) {
  const response = NextResponse.json({ error: message }, { status })
  response.headers.set("Cache-Control", "no-store")
  if (retryAfterSeconds > 0) response.headers.set("Retry-After", String(retryAfterSeconds))
  return response
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return jsonError("Origem da requisição não autorizada.", 403)

  const ipKey = authRateLimitKey("ip", `billing-signin:${requestIp(request)}`)
  const ipState = checkAuthRateLimit(ipKey, IP_LIMIT, WINDOW_MS)
  if (!ipState.allowed) {
    return jsonError("Muitas tentativas de login. Tente novamente mais tarde.", 429, ipState.retryAfterSeconds)
  }

  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null
  if (!body?.email || !body.password) {
    registerAuthFailure(ipKey, WINDOW_MS)
    return jsonError("E-mail ou senha inválidos.", 401)
  }

  const email = body.email.trim().toLowerCase()
  const accountKey = authRateLimitKey("account", `billing:${email}`)
  const accountState = checkAuthRateLimit(accountKey, ACCOUNT_LIMIT, WINDOW_MS)
  if (!accountState.allowed) {
    return jsonError("Muitas tentativas de login. Tente novamente mais tarde.", 429, accountState.retryAfterSeconds)
  }

  try {
    const user = await authenticateAdminUser(email, body.password)
    if (!user) {
      registerAuthFailure(ipKey, WINDOW_MS)
      registerAuthFailure(accountKey, WINDOW_MS)
      return jsonError("E-mail ou senha inválidos.", 401)
    }

    const account = await getBillingAccountForUser(user.id)
    if (!account) {
      registerAuthFailure(accountKey, WINDOW_MS)
      return jsonError("Não foi possível entrar nesta conta.", 403)
    }

    clearAuthFailures(accountKey)
    const response = NextResponse.json({ ok: true, email: user.email })
    response.headers.set("Cache-Control", "no-store")
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
  } catch (reason) {
    console.error(
      "[SaborFlow Billing Login] Falha ao autenticar:",
      reason instanceof Error ? reason.message : reason,
    )
    return jsonError("Não foi possível validar o login no momento.", 503)
  }
}
