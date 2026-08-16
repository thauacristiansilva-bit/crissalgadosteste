import { NextResponse } from "next/server"
import {
  getAdminLoginMode,
  isSessionSecretConfigured,
  legacyAdminLoginAllowed,
} from "@/lib/auth"
import { legacyStoreRuntimeEnabled } from "@/lib/db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { isTenantCatalogReady } from "@/lib/catalog-db"
import { isTenantOrdersReady } from "@/lib/order-db"
import { isTenantCustomersReady } from "@/lib/customer-db"
import { isTenantOperationsReady } from "@/lib/operations-db"
import { isTenantRuntimeReady } from "@/lib/organization-db"
import { getRlsRolloutStats } from "@/lib/organization-security-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sessão multiempresa inválida." },
      { status: 401 },
    )
  }

  try {
    const [
      catalogReady,
      ordersReady,
      customersReady,
      operationsReady,
      runtimeReady,
      rls,
    ] = await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      () =>
        Promise.all([
          isTenantCatalogReady(session.organizationId),
          isTenantOrdersReady(session.organizationId),
          isTenantCustomersReady(session.organizationId),
          isTenantOperationsReady(session.organizationId),
          isTenantRuntimeReady(session.organizationId),
          getRlsRolloutStats(),
        ]),
      "tenant-session",
    )

    const postgresAuthorityReady =
      catalogReady &&
      ordersReady &&
      customersReady &&
      operationsReady &&
      runtimeReady

    const rlsDefinitive =
      rls.prepared &&
      rls.preparedCount > 0 &&
      rls.enabledCount === rls.preparedCount

    const legacyRuntimeDisabled = !legacyStoreRuntimeEnabled()
    const legacyLoginDisabled = !legacyAdminLoginAllowed()
    const sessionSecretConfigured = isSessionSecretConfigured()

    return NextResponse.json({
      ok:
        postgresAuthorityReady &&
        rlsDefinitive &&
        legacyRuntimeDisabled &&
        legacyLoginDisabled &&
        sessionSecretConfigured,
      phase: "25-legacy-shutdown",
      organization: {
        id: session.organizationId,
        name: session.organizationName,
        slug: session.organizationSlug,
      },
      authority: {
        database: "postgresql",
        catalogReady,
        ordersReady,
        customersReady,
        operationsReady,
        runtimeReady,
        postgresAuthorityReady,
      },
      auth: {
        mode: getAdminLoginMode(),
        legacyAdminLoginAllowed: legacyAdminLoginAllowed(),
        sessionSecretConfigured,
      },
      legacy: {
        storeJsonRuntimeEnabled: legacyStoreRuntimeEnabled(),
        storeMirrorEnabled: false,
        currentDeploymentBridgeEnabled: false,
        defaultOrganizationFromAdminEmail: false,
        legacyAdminSessionAccepted: false,
        legacyClientSessionAccepted: false,
      },
      rls: {
        prepared: rls.prepared,
        preparedCount: rls.preparedCount,
        enabledCount: rls.enabledCount,
        definitive: rlsDefinitive,
      },
      boundaries: {
        failClosedInsteadOfLegacyFallback: true,
        publicTenantRequiresSlugDomainCookieOrReferer: true,
        postgresIsOperationalAuthority: true,
        dormantLegacyFilesAreNotRuntimeAuthority: true,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "25-legacy-shutdown",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível validar o desligamento do legado.",
      },
      { status: 503 },
    )
  }
}
