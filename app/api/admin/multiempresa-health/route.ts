import { NextResponse } from "next/server"
import {
  getAdminLoginMode,
} from "@/lib/auth"
import {
  getAdminUserCredentialState,
} from "@/lib/admin-user-db"
import {
  getOrganizationOrderingReadiness,
} from "@/lib/organization-onboarding"
import {
  listOrganizationMembershipsForUserId,
} from "@/lib/tenant-context"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sessão multiempresa inválida.",
      },
      { status: 401 },
    )
  }

  try {
    const [
      credential,
      organizations,
      checkout,
    ] = await Promise.all([
      getAdminUserCredentialState(
        session.email,
      ),
      listOrganizationMembershipsForUserId(
        session.userId,
      ),
      getOrganizationOrderingReadiness(
        session.organizationId,
      ),
    ])

    const databasePasswordReady =
      Boolean(
        credential?.passwordReady,
      )

    return NextResponse.json({
      ok:
        databasePasswordReady &&
        organizations.length > 0 &&
        checkout.runtimeReady &&
        checkout.catalogReady &&
        checkout.ordersReady &&
        checkout.operationsReady &&
        checkout.customersReady,
      auth: {
        mode: getAdminLoginMode(),
        databasePasswordReady,
        sessionSecretConfigured:
          Boolean(
            process.env
              .SESSION_SECRET,
          ),
      },
      user: {
        id: session.userId,
        email: session.email,
      },
      activeOrganization: {
        id:
          session.organizationId,
        name:
          session.organizationName,
        slug:
          session.organizationSlug,
        role: session.role,
      },
      organizations: {
        count:
          organizations.length,
        items:
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
      },
      checkout,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível verificar a Fase 9.",
      },
      { status: 503 },
    )
  }
}
