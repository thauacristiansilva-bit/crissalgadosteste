import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getTenantDeliveryZones, isTenantOperationsReady } from "@/lib/operations-db"
import { getTenantSettings, isTenantRuntimeReady } from "@/lib/organization-db"
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
    return await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      async () => {
        const [operationsReady, runtimeReady] = await Promise.all([
          isTenantOperationsReady(session.organizationId).catch(() => false),
          isTenantRuntimeReady(session.organizationId).catch(() => false),
        ])

        const [deliveryZones, settings] = await Promise.all([
          operationsReady
            ? getTenantDeliveryZones(session.organizationId, { includeInactive: true })
            : Promise.resolve([]),
          runtimeReady ? getTenantSettings(session.organizationId) : Promise.resolve(null),
        ])

        return NextResponse.json({
          ok: operationsReady && runtimeReady && Boolean(settings),
          phase: "25.7.3-delivery-zones-postgresql-only",
          organization: {
            id: session.organizationId,
            name: session.organizationName,
            slug: session.organizationSlug,
          },
          database: "postgresql",
          schemaReady: operationsReady,
          tenantRuntimeReady: runtimeReady,
          counts: {
            deliveryZones: deliveryZones.length,
            activeDeliveryZones: deliveryZones.filter((zone) => zone.active).length,
          },
          capabilities: {
            createDeliveryZonePostgresql: true,
            updateDeliveryZonePostgresql: true,
            deleteDeliveryZonePostgresql: true,
            listDeliveryZonesPostgresql: true,
            pdvDeliveryQuotePostgresql: true,
            explicitTenantRlsScope: true,
          },
          legacy: {
            deliveryZoneFallback: false,
            pdvDeliveryQuoteFallback: false,
            storeJsonWrites: false,
          },
        })
      },
      "tenant-session",
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "25.7.3-delivery-zones-postgresql-only",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível validar áreas de entrega.",
      },
      { status: 503 },
    )
  }
}
