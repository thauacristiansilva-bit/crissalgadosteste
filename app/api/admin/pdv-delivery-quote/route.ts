import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { calculateDeliveryQuote } from "@/lib/delivery-pricing"
import { getTenantDeliveryZones, isTenantOperationsReady } from "@/lib/operations-db"
import { getTenantSettings, isTenantRuntimeReady } from "@/lib/organization-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"
import { canUsePdv } from "@/lib/admin-access"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import {
  finiteNumber,
  InputValidationError,
  latitude,
  longitude,
  validationErrorStatus,
} from "@/lib/security/input-validation"

function internalErrorStatus(error: unknown) {
  const billingStatus = billingErrorStatus(error)
  return billingStatus === 400 ? 500 : billingStatus
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { error: "Sessão da empresa inválida. Entre novamente para calcular a entrega do PDV." },
      { status: 401 },
    )
  }

  if (!canUsePdv(session.role, session.operationalPermissions)) {
    return NextResponse.json({ error: "Seu perfil não pode usar o PDV." }, { status: 403 })
  }

  let latitudeValue: number
  let longitudeValue: number
  let subtotal: number

  try {
    latitudeValue = latitude(request.nextUrl.searchParams.get("lat"))
    longitudeValue = longitude(request.nextUrl.searchParams.get("lng"))
    subtotal = finiteNumber(
      request.nextUrl.searchParams.get("subtotal") || 0,
      "Subtotal",
      { min: 0, max: 100_000_000 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Parâmetros de entrega inválidos." },
      { status: error instanceof InputValidationError ? validationErrorStatus(error) : 400 },
    )
  }

  try {
    return await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      async () => {
        await assertOrganizationEntitlement(session.organizationId, "delivery")

        const [runtimeReady, operationsReady] = await Promise.all([
          isTenantRuntimeReady(session.organizationId).catch(() => false),
          isTenantOperationsReady(session.organizationId).catch(() => false),
        ])

        if (!runtimeReady || !operationsReady) {
          return NextResponse.json(
            {
              error:
                "Configurações de entrega PostgreSQL ainda não estão disponíveis para esta empresa. Não foi usado fallback para store.json.",
            },
            { status: 503 },
          )
        }

        const [settings, zones] = await Promise.all([
          getTenantSettings(session.organizationId),
          getTenantDeliveryZones(session.organizationId),
        ])

        if (!settings) {
          return NextResponse.json(
            { error: "Configurações da empresa indisponíveis." },
            { status: 503 },
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
      "tenant-session",
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível calcular a entrega do PDV.",
      },
      { status: internalErrorStatus(error) },
    )
  }
}
