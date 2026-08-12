import { NextResponse } from "next/server"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageSecurity,
} from "@/lib/admin-access"
import {
  createDomainVerification,
  listOrganizationDomains,
  removeOrganizationDomain,
} from "@/lib/organization-security-db"
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"

export const dynamic = "force-dynamic"

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canManageSecurity(session.role)
  ) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: session ? 403 : 401 },
    )
  }

  return NextResponse.json({
    domains:
      await listOrganizationDomains(
        session.organizationId,
      ),
  })
}

export async function POST(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canManageSecurity(session.role)
  ) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: session ? 403 : 401 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | { domain?: string }
    | null

  try {
    await assertOrganizationEntitlement(session.organizationId, "customDomain")

    const verification =
      await createDomainVerification({
        organizationId:
          session.organizationId,
        domain:
          body?.domain || "",
      })

    return NextResponse.json({
      verification,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível cadastrar o domínio.",
      },
      { status: billingErrorStatus(error) },
    )
  }
}

export async function DELETE(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canManageSecurity(session.role)
  ) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: session ? 403 : 401 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | { domain?: string }
    | null

  try {
    await removeOrganizationDomain({
      organizationId:
        session.organizationId,
      domain:
        body?.domain || "",
    })

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível remover o domínio.",
      },
      { status: 400 },
    )
  }
}
