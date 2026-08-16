import { NextResponse } from "next/server"
import { getDeliveryTrackingHealth } from "@/lib/delivery-tracking-db"
import { getTenantSettings } from "@/lib/organization-db"
import { permissionListHas } from "@/lib/operational-permissions"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const mayInspect =
    session.role === "courier" ||
    permissionListHas(session.operationalPermissions, "delivery.manage")

  if (!mayInspect) {
    return NextResponse.json(
      { error: "Seu perfil não pode acessar a operação de entrega." },
      { status: 403 },
    )
  }

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () => {
      try {
        const [health, settings] = await Promise.all([
          getDeliveryTrackingHealth(session.organizationId),
          getTenantSettings(session.organizationId),
        ])

        return NextResponse.json(
          {
            ok: health.schemaReady,
            phase: "25.4-25.5-delivery-routing-live-tracking",
            organization: {
              id: session.organizationId,
              name: session.organizationName,
              slug: session.organizationSlug,
            },
            schemaReady: health.schemaReady,
            settings: {
              trackingEnabled: settings?.deliveryTrackingEnabled !== false,
            },
            counts: {
              activeRoutes: health.activeRoutes,
              freshLocations: health.freshLocations,
              staleLocations: health.staleLocations,
            },
            publicUrls: {
              appBaseUrlConfigured: Boolean(process.env.APP_BASE_URL?.trim()),
              railwayPublicDomainConfigured: Boolean(
                process.env.RAILWAY_PUBLIC_DOMAIN?.trim(),
              ),
            },
            capabilities: {
              routeFromCurrentLocationToCustomer: true,
              browserGpsWatch: true,
              screenWakeLockWhileRouteIsOpen: true,
              oneActiveDeliveryPerCourier: true,
              liveCustomerMap: true,
              trackingCanBeDisabledPerOrganization: true,
              postgresTenantAware: true,
              postgresRlsPreserved: true,
            },
            privacy: {
              locationOnlyForActiveOrder: true,
              otherDeliveryLocationHidden: true,
              waitingCustomerSeesOtherDeliveryMessageOnly: true,
              locationClearedWhenDeliveryFinishes: true,
              staleLocationNotExposedAfterTwoMinutes: true,
              browserBackgroundTrackingIsBestEffort: true,
            },
          },
          { status: health.schemaReady ? 200 : 503 },
        )
      } catch (error) {
        return NextResponse.json(
          {
            ok: false,
            phase: "25.4-25.5-delivery-routing-live-tracking",
            error:
              error instanceof Error
                ? error.message
                : "Falha ao validar rastreamento de entregas.",
          },
          { status: 500 },
        )
      }
    },
    "tenant-session",
  )
}
