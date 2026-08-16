import {
  NextRequest,
  NextResponse,
} from "next/server"
import {
  getTenantDeliveryZones,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import {
  getTenantSettings,
  isTenantRuntimeReady,
} from "@/lib/organization-db"
import {
  resolvePublicOrganizationForRequest,
} from "@/lib/public-tenant"
import {
  calculateDeliveryQuote,
} from "@/lib/delivery-pricing"
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"

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

    await assertOrganizationEntitlement(organization.id, "delivery")

    return runWithTenantRlsScope(
      [organization.id],
      undefined,
      async () => {
        const [runtimeReady, operationsReady] = await Promise.all([
          isTenantRuntimeReady(organization.id).catch(() => false),
          isTenantOperationsReady(organization.id).catch(() => false),
        ])

        if (!runtimeReady || !operationsReady) {
          throw new Error(
            "Entrega ainda não foi habilitada para esta empresa.",
          )
        }

        const [settings, zones] = await Promise.all([
          getTenantSettings(organization.id),
          getTenantDeliveryZones(organization.id),
        ])

        if (!settings) {
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
      },
      "public-store",
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível calcular a entrega.",
      },
      { status: billingErrorStatus(error) },
    )
  }
}
