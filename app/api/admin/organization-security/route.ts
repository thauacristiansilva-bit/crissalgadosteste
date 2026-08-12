import { NextResponse } from "next/server"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageSecurity,
} from "@/lib/admin-access"
import {
  getOrganizationTimeZone,
  listOrganizationDomains,
  listPrintAgents,
  updateOrganizationTimeZone,
} from "@/lib/organization-security-db"

export const dynamic = "force-dynamic"

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Sessão multiempresa inválida.",
      },
      { status: 401 },
    )
  }

  const timeZone =
    await getOrganizationTimeZone(
      session.organizationId,
    )

  if (
    !canManageSecurity(
      session.role,
    )
  ) {
    return NextResponse.json({
      organization: {
        id:
          session.organizationId,
        name:
          session.organizationName,
        slug:
          session.organizationSlug,
      },
      role: session.role,
      timeZone,
      domains: [],
      printAgents: [],
      canManageSecurity: false,
    })
  }

  const [
    domains,
    printAgents,
  ] = await Promise.all([
    listOrganizationDomains(
      session.organizationId,
    ),
    listPrintAgents(
      session.organizationId,
    ),
  ])

  return NextResponse.json({
    organization: {
      id:
        session.organizationId,
      name:
        session.organizationName,
      slug:
        session.organizationSlug,
    },
    role: session.role,
    timeZone,
    domains,
    printAgents,
    canManageSecurity: true,
  })
}

export async function PATCH(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Sessão multiempresa inválida.",
      },
      { status: 401 },
    )
  }

  if (
    !canManageSecurity(
      session.role,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Seu perfil não pode alterar a configuração da organização.",
      },
      { status: 403 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | { timeZone?: string }
    | null

  if (!body?.timeZone) {
    return NextResponse.json(
      {
        error:
          "Informe o timezone.",
      },
      { status: 400 },
    )
  }

  try {
    const timeZone =
      await updateOrganizationTimeZone(
        session.organizationId,
        body.timeZone,
      )

    return NextResponse.json({
      ok: true,
      timeZone,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar.",
      },
      { status: 400 },
    )
  }
}
