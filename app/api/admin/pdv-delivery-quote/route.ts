import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getDeliveryZones, getSettings } from "@/lib/db"
import { calculateDeliveryQuote } from "@/lib/delivery-pricing"
import { getTenantDeliveryZones, isTenantOperationsReady } from "@/lib/operations-db"
import { getTenantSettings, isTenantRuntimeReady } from "@/lib/organization-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canUsePdv } from "@/lib/admin-access"

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const latitude = Number(request.nextUrl.searchParams.get("lat"))
  const longitude = Number(request.nextUrl.searchParams.get("lng"))
  const subtotal = Number(request.nextUrl.searchParams.get("subtotal") || 0)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Latitude e longitude são obrigatórias." }, { status: 400 })
  }

  try {
    const session = await getVerifiedTenantSession()

    if (session) {
      if (!canUsePdv(session.role)) {
        return NextResponse.json({ error: "Seu perfil não pode usar o PDV." }, { status: 403 })
      }

      const [runtimeReady, operationsReady] = await Promise.all([
        isTenantRuntimeReady(session.organizationId).catch(() => false),
        isTenantOperationsReady(session.organizationId).catch(() => false),
      ])

      if (!runtimeReady || !operationsReady) {
        throw new Error("Configurações de entrega ainda não estão disponíveis para esta empresa.")
      }

      const [settings, zones] = await Promise.all([
        getTenantSettings(session.organizationId),
        getTenantDeliveryZones(session.organizationId),
      ])

      if (!settings) throw new Error("Configurações da empresa indisponíveis.")

      const quote = await calculateDeliveryQuote(
        settings,
        zones,
        latitude,
        longitude,
        Number.isFinite(subtotal) ? subtotal : 0,
      )

      return NextResponse.json({ quote })
    }

    const [settings, zones] = await Promise.all([getSettings(), getDeliveryZones()])
    const quote = await calculateDeliveryQuote(
      settings,
      zones,
      latitude,
      longitude,
      Number.isFinite(subtotal) ? subtotal : 0,
    )

    return NextResponse.json({ quote })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível calcular a entrega do PDV." },
      { status: 400 },
    )
  }
}
