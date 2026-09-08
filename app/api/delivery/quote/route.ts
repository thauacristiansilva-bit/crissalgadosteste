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
import {
  finiteNumber,
  InputValidationError,
  latitude,
  longitude,
  validationErrorStatus,
} from "@/lib/security/input-validation"

export async function GET(request: NextRequest) {
  let latitudeValue: number
  let longitudeValue: number
  let subtotal: number

  try {
    latitudeValue = latitude(
      request.nextUrl.searchParams.get("lat"),
    )
    longitudeValue = longitude(
      request.nextUrl.searchParams.get("lng"),
    )
    subtotal = finiteNumber(
      request.nextUrl.searchParams.get("subtotal") || 0,
      "Subtotal",
      { min: 0, max: 100_000_000 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Parâmetros de entrega inválidos.",
      },
      {
        status:
          error instanceof InputValidationError
            ? validationErrorStatus(error)
            : 400,
      },
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
          latitudeValue,
          longitudeValue,
          subtotal,
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
