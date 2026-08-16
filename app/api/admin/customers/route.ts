import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createCustomerAccount as createLegacyCustomerAccount,
  getCustomers as getLegacyCustomers,
  safeCustomer,
  syncLegacyCustomerAccountFromTenant,
} from "@/lib/db"
import {
  createTenantCustomerAccount,
  getTenantCustomers,
  isTenantCustomersReady,
  safeTenantCustomer,
} from "@/lib/customer-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  getSettings,
} from "@/lib/db"
import { canManageCustomers } from "@/lib/tenant-permissions"

interface CustomerInput {
  cpf?: string
  pin?: string
  name?: string
  phone?: string
  email?: string
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | (CustomerInput & { customers?: CustomerInput[] })
    | null

  if (!body) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 },
    )
  }

  const entries = Array.isArray(body.customers)
    ? body.customers
    : [body]

  if (!entries.length || entries.length > 300) {
    return NextResponse.json(
      { error: "Envie entre 1 e 300 clientes por vez." },
      { status: 400 },
    )
  }

  const session = await getVerifiedTenantSession()
  const tenantReady =
    session &&
    (await isTenantCustomersReady(
      session.organizationId,
    ).catch(() => false))

  if (
    session &&
    tenantReady &&
    !canManageCustomers(session.role)
  ) {
    return NextResponse.json(
      { error: "Seu perfil não pode cadastrar clientes." },
      { status: 403 },
    )
  }

  const settings = await getSettings()
  const created = []
  const errors: Array<{
    row: number
    error: string
  }> = []

  for (let index = 0; index < entries.length; index += 1) {
    const item = entries[index]

    try {
      const account =
        session && tenantReady
          ? await createTenantCustomerAccount(
              session.organizationId,
              {
                cpf: item.cpf || "",
                pin: item.pin || "",
                name: item.name || "",
                phone: item.phone || "",
                email: item.email || "",
                defaultCity: settings.city,
                defaultState: settings.state,
              },
            )
          : await createLegacyCustomerAccount({
              cpf: item.cpf || "",
              pin: item.pin || "",
              name: item.name || "",
              phone: item.phone || "",
              email: item.email || "",
            })

      if (
        session &&
        tenantReady &&
        (await isCurrentDeploymentOrganization(
          session.organizationId,
        ))
      ) {
        await syncLegacyCustomerAccountFromTenant(
          account,
        )
      }

      created.push(
        session && tenantReady
          ? safeTenantCustomer(account)
          : safeCustomer(account),
      )
    } catch (error) {
      errors.push({
        row: index + 1,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível cadastrar.",
      })
    }
  }

  const customers =
    session && tenantReady
      ? await getTenantCustomers(session.organizationId)
      : await getLegacyCustomers()

  return NextResponse.json(
    {
      created,
      errors,
      customers,
    },
    {
      status: created.length ? 201 : 400,
    },
  )
}
