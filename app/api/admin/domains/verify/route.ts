import { NextResponse } from "next/server"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageSecurity,
} from "@/lib/admin-access"
import {
  verifyOrganizationDomain,
} from "@/lib/organization-security-db"

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
    return NextResponse.json(
      await verifyOrganizationDomain({
        organizationId:
          session.organizationId,
        domain:
          body?.domain || "",
      }),
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "A verificação falhou.",
      },
      { status: 400 },
    )
  }
}
