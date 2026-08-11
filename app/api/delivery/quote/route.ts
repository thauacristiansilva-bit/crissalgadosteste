import {
  NextRequest,
  NextResponse,
} from "next/server"
import {
  getDeliveryZones as getLegacyDeliveryZones,
  getSettings as getLegacySettings,
} from "@/lib/db"
import {
  getTenantDeliveryZones,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import {
  getTenantSettings,
  isTenantRuntimeReady,
} from "@/lib/organization-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  resolvePublicOrganizationForRequest,
} from "@/lib/public-tenant"
import {
  calculateDeliveryQuote,
} from "@/lib/delivery-pricing"

export async function GET(request: NextRequest) {
  const latitude = Number(
    request.nextUrl.searchParams.get("lat"),
  )
  const longitude = Number(
    request.nextUrl.searchParams.get("lng"),
  )
  const subtotal = Number(
    request.nextUrl.searchParams.get("subtotal") || 0,
  )

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return NextResponse.json(
      {
        error:
          "Latitude e longitude são obrigatórias.",
      },
      { status: 400 },
    )
  }

  try {
    const organization =
      await resolvePublicOrganizationForRequest(
        request,
      )

    if (!organization) {
      throw new Error("Empresa não encontrada.")
    }

    const runtimeReady =
      await isTenantRuntimeReady(
        organization.id,
      ).catch(() => false)

    const operationsReady =
      await isTenantOperationsReady(
        organization.id,
      ).catch(() => false)

    const isCurrent =
      await isCurrentDeploymentOrganization(
        organization.id,
      )

    const settings =
      runtimeReady
        ? await getTenantSettings(organization.id)
        : isCurrent
          ? await getLegacySettings()
          : null

    const zones =
      operationsReady
        ? await getTenantDeliveryZones(
            organization.id,
          )
        : isCurrent
          ? await getLegacyDeliveryZones()
          : null

    if (!settings || !zones) {
      throw new Error(
        "Entrega ainda não foi habilitada para esta empresa.",
      )
    }

    const quote = await calculateDeliveryQuote(
      settings,
      zones,
      latitude,
      longitude,
      Number.isFinite(subtotal)
        ? subtotal
        : 0,
    )

    return NextResponse.json({ quote })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível calcular a entrega.",
      },
      { status: 400 },
    )
  }
}
