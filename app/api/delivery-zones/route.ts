import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createDeliveryZone as createLegacyDeliveryZone,
  getDeliveryZones as getLegacyDeliveryZones,
  syncLegacyDeliveryZoneFromTenant,
} from "@/lib/db"
import {
  createTenantDeliveryZone,
  getTenantDeliveryZones,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageDeliveryOperation,
} from "@/lib/tenant-permissions"
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const session = await getVerifiedTenantSession()

  if (
    session &&
    (await isTenantOperationsReady(
      session.organizationId,
    ).catch(() => false))
  ) {
    try {
      await assertOrganizationEntitlement(session.organizationId, "delivery")
      return NextResponse.json({
        deliveryZones: await getTenantDeliveryZones(
          session.organizationId,
          { includeInactive: true },
        ),
      })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Delivery indisponível no plano." },
        { status: billingErrorStatus(error) },
      )
    }
  }

  return NextResponse.json({
    deliveryZones: await getLegacyDeliveryZones({
      includeInactive: true,
    }),
  })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!body) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 },
    )
  }

  const input = {
    name: String(body.name || ""),
    centerLat: Number(body.centerLat),
    centerLng: Number(body.centerLng),
    radiusMeters: Number(body.radiusMeters || 1500),
    fee: Number(body.fee),
    shape:
      body.shape === "polygon"
        ? ("polygon" as const)
        : ("circle" as const),
    points: Array.isArray(body.points)
      ? (body.points as Array<{
          lat: number
          lng: number
        }>)
      : [],
  }

  try {
    const session = await getVerifiedTenantSession()
    const ready =
      session &&
      (await isTenantOperationsReady(
        session.organizationId,
      ).catch(() => false))

    if (!session || !ready) {
      const deliveryZone =
        await createLegacyDeliveryZone(input)

      return NextResponse.json(
        { deliveryZone },
        { status: 201 },
      )
    }

    if (!canManageDeliveryOperation(session.role)) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode alterar áreas de entrega.",
        },
        { status: 403 },
      )
    }

    await assertOrganizationEntitlement(session.organizationId, "delivery")

    const deliveryZone =
      await createTenantDeliveryZone(
        session.organizationId,
        input,
      )

    if (
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )
    ) {
      await syncLegacyDeliveryZoneFromTenant(
        deliveryZone,
      )
    }

    return NextResponse.json(
      { deliveryZone },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível cadastrar a área.",
      },
      { status: billingErrorStatus(error) },
    )
  }
}
