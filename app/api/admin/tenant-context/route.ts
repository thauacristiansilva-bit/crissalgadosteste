import { NextResponse } from "next/server"
import {
  getAdminSession,
} from "@/lib/auth"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  listOrganizationMembershipsForUserId,
} from "@/lib/tenant-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const rawSession =
    await getAdminSession()

  if (!rawSession) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Não autorizado.",
      },
      { status: 401 },
    )
  }

  if (
    rawSession.mode === "legacy"
  ) {
    return NextResponse.json({
      ok: true,
      sessionMode: "legacy",
      email: rawSession.email,
      organization: null,
      organizations: [],
      message:
        "Login ainda está em modo legado.",
    })
  }

  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A membership ativa não existe mais.",
      },
      { status: 403 },
    )
  }

  const organizations =
    await listOrganizationMembershipsForUserId(
      session.userId,
    )

  return NextResponse.json({
    ok: true,
    sessionMode: "tenant",
    user: {
      id: session.userId,
      email: session.email,
      role: session.role,
    },
    organization: {
      id:
        session.organizationId,
      name:
        session.organizationName,
      slug:
        session.organizationSlug,
    },
    activeMembership: true,
    organizations:
      organizations.map(
        (organization) => ({
          id:
            organization.organizationId,
          name:
            organization.organizationName,
          slug:
            organization.organizationSlug,
          role:
            organization.role,
          publicOrderingEnabled:
            organization.publicOrderingEnabled,
        }),
      ),
  })
}
