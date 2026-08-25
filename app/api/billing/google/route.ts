import { NextResponse } from "next/server"
import {
  BILLING_SESSION_COOKIE,
  commercialBillingCookieOptions,
  createCommercialBillingSessionToken,
} from "@/lib/billing-commercial-session"
import {
  authenticateCommercialGoogleUser,
  registerCommercialGoogleUser,
} from "@/lib/billing-contracting"
import { verifyGoogleCredential } from "@/lib/auth-providers/google"
import {
  authRateLimitKey,
  checkAuthRateLimit,
  registerAuthFailure,
} from "@/lib/security/rate-limit"
import { requestIp, requestIsSameOrigin } from "@/lib/security/request-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LIMIT = 20
const WINDOW_MS = 15 * 60 * 1000

function error(message: string, status: number, retryAfterSeconds = 0) {
  const response = NextResponse.json({ error: message }, { status })
  response.headers.set("Cache-Control", "no-store")
  if (retryAfterSeconds > 0) response.headers.set("Retry-After", String(retryAfterSeconds))
  return response
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return error("Origem da requisição não autorizada.", 403)
  }

  const key = authRateLimitKey("ip", `billing-google:${requestIp(request)}`)
  const state = checkAuthRateLimit(key, LIMIT, WINDOW_MS)
  if (!state.allowed) {
    return error("Muitas tentativas. Tente novamente mais tarde.", 429, state.retryAfterSeconds)
  }

  const body = await request.json().catch(() => null) as {
    mode?: "signup" | "signin"
    credential?: string
    cpf?: string
    hasCnpj?: boolean
    cnpj?: string
  } | null

  if (!body?.credential || !body.mode) {
    registerAuthFailure(key, WINDOW_MS)
    return error("Não foi possível validar sua Conta Google.", 400)
  }

  try {
    const google = await verifyGoogleCredential(body.credential)
    const account = body.mode === "signup"
      ? await registerCommercialGoogleUser({
          name: google.name,
          email: google.email,
          googleSubject: google.subject,
          cpf: body.cpf || "",
          hasCnpj: Boolean(body.hasCnpj),
          cnpj: body.cnpj || "",
        })
      : await authenticateCommercialGoogleUser({
          googleSubject: google.subject,
          email: google.email,
        })

    if (!account) {
      registerAuthFailure(key, WINDOW_MS)
      return error(
        "Esta Conta Google ainda não está vinculada ao SaborFlow. Entre com e-mail e senha ou crie uma nova conta.",
        403,
      )
    }

    const response = NextResponse.json({ ok: true, email: account.email })
    response.headers.set("Cache-Control", "no-store")
    response.cookies.set(
      BILLING_SESSION_COOKIE,
      createCommercialBillingSessionToken(account),
      commercialBillingCookieOptions,
    )
    return response
  } catch (reason) {
    registerAuthFailure(key, WINDOW_MS)
    console.error(
      "[SaborFlow Google Billing] Falha ao autenticar:",
      reason instanceof Error ? reason.message : reason,
    )
    return error(
      reason instanceof Error ? reason.message : "Não foi possível continuar com Google.",
      400,
    )
  }
}
