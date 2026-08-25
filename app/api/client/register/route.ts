import { NextResponse } from "next/server"
import {
  createTenantCustomerAccount,
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
import { authRateLimitKey, checkAuthRateLimit, registerAuthFailure } from "@/lib/security/rate-limit"
import { requestIp } from "@/lib/security/request-security"

const REGISTER_LIMIT = 12
const REGISTER_WINDOW_MS = 60 * 60 * 1000

export async function POST(request: Request) {
  const registerKey = authRateLimitKey("ip", `client-register:${requestIp(request)}`)
  const registerState = checkAuthRateLimit(
    registerKey,
    REGISTER_LIMIT,
    REGISTER_WINDOW_MS,
  )

  if (!registerState.allowed) {
    const response = NextResponse.json(
      { error: "Muitas tentativas de cadastro. Tente novamente mais tarde." },
      { status: 429 },
    )
    response.headers.set("Retry-After", String(registerState.retryAfterSeconds))
    return response
  }

  registerAuthFailure(registerKey, REGISTER_WINDOW_MS)

  const body = (await request.json().catch(() => null)) as
    | {
        cpf?: string
        pin?: string
        name?: string
        phone?: string
        email?: string
        remember?: boolean
      }
    | null

  if (!body) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 },
    )
  }

  const organization = await resolvePublicOrganizationForRequest(request)
  if (!organization) {
    return NextResponse.json(
      { error: "Empresa não identificada. Abra a loja pelo link /loja/{slug}." },
      { status: 404 },
    )
  }

  return runWithTenantRlsScope(
    [organization.id],
    undefined,
    async () => {
      try {
        const [customersReady, runtimeReady] = await Promise.all([
          isTenantCustomersReady(organization.id),
          isTenantRuntimeReady(organization.id),
        ])

        if (!customersReady || !runtimeReady) {
          return NextResponse.json(
            { error: "Cadastro de clientes ainda não está disponível nesta empresa." },
            { status: 503 },
          )
        }

        const settings = await getTenantSettings(organization.id)
        if (!settings) {
          return NextResponse.json(
            { error: "Configurações da empresa ainda não estão disponíveis." },
            { status: 503 },
          )
        }

        const account = await createTenantCustomerAccount(
          organization.id,
          {
            cpf: body.cpf || "",
            pin: body.pin || "",
            name: body.name || "",
            phone: body.phone || "",
            email: body.email || "",
            defaultCity: settings.city,
            defaultState: settings.state,
          },
        )

        const days = body.remember === false ? 1 : settings.rememberClientDays
        const response = NextResponse.json(
          {
            customer: safeTenantCustomer(account),
            sessionMode: "tenant",
          },
          { status: 201 },
        )

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
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível criar a conta.",
          },
          { status: 400 },
        )
      }
    },
    "customer-session",
  )
}
