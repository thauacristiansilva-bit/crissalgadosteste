import { NextResponse } from "next/server"
import {
  authenticateCustomer as authenticateLegacyCustomer,
  getSettings,
  safeCustomer,
} from "@/lib/db"
import {
  authenticateTenantCustomer,
  isTenantCustomersReady,
  safeTenantCustomer,
} from "@/lib/customer-db"
import {
  getCurrentDeploymentOrganizationId,
} from "@/lib/catalog-db"
import {
  CLIENT_SESSION_COOKIE,
  LEGACY_CLIENT_SESSION_COOKIE,
  createClientToken,
} from "@/lib/client-auth"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        cpf?: string
        pin?: string
        remember?: boolean
      }
    | null

  if (!body) {
    return NextResponse.json(
      { error: "Informe CPF e PIN." },
      { status: 400 },
    )
  }

  const organizationId =
    await getCurrentDeploymentOrganizationId()

  if (!organizationId) {
    return NextResponse.json(
      { error: "Empresa não disponível." },
      { status: 503 },
    )
  }

  const customersReady =
    await isTenantCustomersReady(organizationId).catch(() => false)

  const account = customersReady
    ? await authenticateTenantCustomer(
        organizationId,
        body.cpf || "",
        body.pin || "",
      )
    : await authenticateLegacyCustomer(
        body.cpf || "",
        body.pin || "",
      )

  if (!account) {
    return NextResponse.json(
      { error: "CPF ou PIN inválido." },
      { status: 401 },
    )
  }

  const settings = await getSettings()
  const days =
    body.remember === false
      ? 1
      : settings.rememberClientDays

  const response = NextResponse.json({
    customer: customersReady
      ? safeTenantCustomer(account)
      : safeCustomer(account),
    sessionMode: customersReady ? "tenant" : "legacy",
  })

  response.cookies.set(
    CLIENT_SESSION_COOKIE,
    createClientToken(
      organizationId,
      account.id,
      days,
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: days * 86_400,
    },
  )

  response.cookies.set(
    LEGACY_CLIENT_SESSION_COOKIE,
    "",
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    },
  )

  return response
}
