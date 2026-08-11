import { NextResponse } from "next/server"
import {
  createCustomerAccount as createLegacyCustomerAccount,
  getSettings,
  safeCustomer,
  syncLegacyCustomerAccountFromTenant,
} from "@/lib/db"
import {
  createTenantCustomerAccount,
  isTenantCustomersReady,
  safeTenantCustomer,
} from "@/lib/customer-db"
import {
  getCurrentDeploymentOrganizationId,
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  resolvePublicOrganizationForRequest,
} from "@/lib/public-tenant"
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

  const publicOrganization =
    await resolvePublicOrganizationForRequest(
      request,
    )

  const organizationId =
    publicOrganization?.id ||
    (await getCurrentDeploymentOrganizationId())

  if (!organizationId) {
    return NextResponse.json(
      { error: "Empresa não disponível." },
      { status: 503 },
    )
  }

  try {
    const customersReady =
      await isTenantCustomersReady(organizationId)

    if (
      !customersReady &&
      !(await isCurrentDeploymentOrganization(
        organizationId,
      ))
    ) {
      return NextResponse.json(
        {
          error:
            "Cadastro de clientes ainda não foi habilitado para esta empresa.",
        },
        { status: 503 },
      )
    }

    const settings = await getSettings()

    const account = customersReady
      ? await createTenantCustomerAccount(
          organizationId,
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
      : await createLegacyCustomerAccount({
          cpf: body.cpf || "",
          pin: body.pin || "",
          name: body.name || "",
          phone: body.phone || "",
          email: body.email || "",
        })

    if (
      customersReady &&
      (await isCurrentDeploymentOrganization(
        organizationId,
      ))
    ) {
      await syncLegacyCustomerAccountFromTenant(account)
    }

    const days =
      body.remember === false
        ? 1
        : settings.rememberClientDays

    const response = NextResponse.json(
      {
        customer: customersReady
          ? safeTenantCustomer(account)
          : safeCustomer(account),
        sessionMode: customersReady ? "tenant" : "legacy",
      },
      { status: 201 },
    )

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
}
