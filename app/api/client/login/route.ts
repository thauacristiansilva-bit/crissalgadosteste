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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { cpf?: string; pin?: string; remember?: boolean }
    | null

  if (!body) {
    return NextResponse.json(
      { error: "Informe CPF e PIN." },
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
      const [customersReady, runtimeReady] = await Promise.all([
        isTenantCustomersReady(organization.id).catch(() => false),
        isTenantRuntimeReady(organization.id).catch(() => false),
      ])

      if (!customersReady || !runtimeReady) {
        return NextResponse.json(
          { error: "Contas de clientes ainda não estão disponíveis nesta empresa." },
          { status: 503 },
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
        return NextResponse.json(
          { error: "CPF ou PIN inválido." },
          { status: 401 },
        )
      }

      if (!settings) {
        return NextResponse.json(
          { error: "Configurações da empresa não estão disponíveis." },
          { status: 503 },
        )
      }

      const days = body.remember === false ? 1 : settings.rememberClientDays
      const response = NextResponse.json({
        customer: safeTenantCustomer(account),
        sessionMode: "tenant",
      })

      response.cookies.set(
        CLIENT_SESSION_COOKIE,
        createClientToken(organization.id, account.id, days),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: days * 86_400,
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
