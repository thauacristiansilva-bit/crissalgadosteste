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
import { assertDemoActionAllowed, demoPolicyErrorStatus } from "@/lib/demo-policy"

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
    await assertDemoActionAllowed(session.organizationId, "custom-domain")
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
      { status: demoPolicyErrorStatus(error) },
    )
  }
}
