import { NextResponse } from "next/server"
import {
  authenticateTenantCustomer,
  isTenantCustomersReady,
  safeTenantCustomer,
} from "@/lib/customer-db"
import {
  resolvePublicOrganizationForRequest,
} from "@/lib/public-tenant"
import {
  getTenantSettings,
  isTenantRuntimeReady,
} from "@/lib/organization-db"
import {
  CLIENT_SESSION_COOKIE,
  LEGACY_CLIENT_SESSION_COOKIE,
  createClientToken,
} from "@/lib/client-auth"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import {
  authRateLimitKey,
  checkAuthRateLimit,
  clearAuthFailures,
  registerAuthFailure,
} from "@/lib/security/rate-limit"
import { requestIp } from "@/lib/security/request-security"

const ACCOUNT_LIMIT = 6
const IP_LIMIT = 40
const RATE_WINDOW_MS = 15 * 60 * 1000

function errorResponse(message: string, status: number, retryAfterSeconds = 0) {
  const response = NextResponse.json({ error: message }, { status })
  response.headers.set("Cache-Control", "no-store")
  if (retryAfterSeconds > 0) {
    response.headers.set("Retry-After", String(retryAfterSeconds))
  }
  return response
}

export async function POST(request: Request) {
  const ipKey = authRateLimitKey("ip", `client:${requestIp(request)}`)
  const ipState = checkAuthRateLimit(ipKey, IP_LIMIT, RATE_WINDOW_MS)
  if (!ipState.allowed) {
    return errorResponse(
      "Muitas tentativas de acesso. Tente novamente mais tarde.",
      429,
      ipState.retryAfterSeconds,
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { cpf?: string; pin?: string; remember?: boolean }
    | null

  if (!body) {
    registerAuthFailure(ipKey, RATE_WINDOW_MS)
    return errorResponse("Informe CPF e PIN.", 400)
  }

  const organization = await resolvePublicOrganizationForRequest(request)
  if (!organization) {
    return errorResponse(
      "Empresa não identificada. Abra a loja pelo link correto.",
      404,
    )
  }

  const cpfKey = authRateLimitKey(
    "account",
    `client:${organization.id}:${String(body.cpf || "").replace(/\D/g, "")}`,
  )
  const cpfState = checkAuthRateLimit(cpfKey, ACCOUNT_LIMIT, RATE_WINDOW_MS)
  if (!cpfState.allowed) {
    return errorResponse(
      "Muitas tentativas de acesso. Tente novamente mais tarde.",
      429,
      cpfState.retryAfterSeconds,
    )
  }

  return runWithTenantRlsScope(
    [organization.id],
    undefined,
    async () => {
      const [customersReady, runtimeReady] = await Promise.all([
        isTenantCustomersReady(organization.id).catch(() => false),
        isTenantRuntimeReady(organization.id).catch(() => false),
      ])

      if (!customersReady || !runtimeReady) {
        return errorResponse(
          "Contas de clientes ainda não estão disponíveis nesta empresa.",
          503,
        )
      }

      const [account, settings] = await Promise.all([
        authenticateTenantCustomer(
          organization.id,
          body.cpf || "",
          body.pin || "",
        ),
        getTenantSettings(organization.id),
      ])

      if (!account) {
        registerAuthFailure(ipKey, RATE_WINDOW_MS)
        registerAuthFailure(cpfKey, RATE_WINDOW_MS)
        return errorResponse("CPF ou PIN inválido.", 401)
      }

      if (!settings) {
        return errorResponse(
          "Configurações da empresa não estão disponíveis.",
          503,
        )
      }

      clearAuthFailures(cpfKey)

      const days = body.remember === false ? 1 : settings.rememberClientDays
      const response = NextResponse.json({
        customer: safeTenantCustomer(account),
        sessionMode: "tenant",
      })
      response.headers.set("Cache-Control", "no-store")

      response.cookies.set(
        CLIENT_SESSION_COOKIE,
        createClientToken(organization.id, account.id, days),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: days * 86_400,
          priority: "high",
        },
      )

      response.cookies.set(LEGACY_CLIENT_SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      })

      return response
    },
    "customer-session",
  )
}
