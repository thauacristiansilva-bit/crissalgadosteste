import { NextResponse } from "next/server"
import {
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
  getTenantSettings,
} from "@/lib/organization-db"
import {
  canManageCustomers,
  canViewFinance,
} from "@/lib/tenant-permissions"

interface CustomerInput {
  cpf?: string
  pin?: string
  name?: string
  phone?: string
  email?: string
}

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Sessao administrativa invalida ou expirada." },
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

  const tenantReady = await isTenantCustomersReady(
    session.organizationId,
  ).catch(() => false)

  if (!tenantReady) {
    return NextResponse.json(
      { error: "Cadastro de clientes temporariamente indisponivel." },
      { status: 503 },
    )
  }

  if (!canManageCustomers(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil nao pode cadastrar clientes." },
      { status: 403 },
    )
  }

  const settings = await getTenantSettings(session.organizationId)

  if (!settings) {
    return NextResponse.json(
      { error: "Configuracao da organizacao nao encontrada." },
      { status: 503 },
    )
  }

  const created = []
  const errors: Array<{
    row: number
    error: string
  }> = []

  for (let index = 0; index < entries.length; index += 1) {
    const item = entries[index]

    try {
      const account = await createTenantCustomerAccount(
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

      if (
        await isCurrentDeploymentOrganization(
          session.organizationId,
        )
      ) {
        await syncLegacyCustomerAccountFromTenant(
          account,
        )
      }

      created.push(safeTenantCustomer(account))
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

  const customers = await getTenantCustomers(
    session.organizationId,
  )
  const canFinance = canViewFinance(session.role)
  const safeCustomers = canFinance
    ? customers
    : customers.map((customer) => ({
        ...customer,
        totalSpent: 0,
      }))

  return NextResponse.json(
    {
      created,
      errors,
      customers: safeCustomers,
    },
    {
      status: created.length ? 201 : 400,
    },
  )
}
