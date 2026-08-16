import { NextResponse } from "next/server"
import {
  getTenantOrderByReference,
  isTenantOrdersReady,
} from "@/lib/order-db"
import {
  getTenantSettings,
  isTenantRuntimeReady,
} from "@/lib/organization-db"
import {
  resolvePublicOrganizationForRequest,
} from "@/lib/public-tenant"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getPublicDeliveryTracking } from "@/lib/delivery-tracking-db"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: {
    params: Promise<{ reference: string }>
  },
) {
  const { reference } = await context.params

  const organization =
    await resolvePublicOrganizationForRequest(
      request,
    )

  if (!organization) {
    return NextResponse.json(
      { error: "Pedido não encontrado." },
      { status: 404 },
    )
  }

  return runWithTenantRlsScope(
    [organization.id],
    undefined,
    async () => {
      const ordersReady =
        await isTenantOrdersReady(
          organization.id,
        ).catch(() => false)

      if (!ordersReady) {
        return NextResponse.json(
          { error: "Pedido não encontrado." },
          { status: 404 },
        )
      }

      const order = await getTenantOrderByReference(
        organization.id,
        reference,
      )

      if (!order) {
        return NextResponse.json(
          { error: "Pedido não encontrado." },
          { status: 404 },
        )
      }

      const runtimeReady =
        await isTenantRuntimeReady(
          organization.id,
        ).catch(() => false)

      const settings = runtimeReady
        ? await getTenantSettings(organization.id)
        : null

      if (!settings) {
        return NextResponse.json(
          { error: "Loja indisponível." },
          { status: 503 },
        )
      }

      const tracking = await getPublicDeliveryTracking({
        organizationId: organization.id,
        order,
        enabled: settings.deliveryTrackingEnabled !== false,
      })

      return NextResponse.json({
        order,
        tracking,
        store: {
          storeName: settings.storeName,
          whatsapp: settings.whatsapp,
          estimatedMinutes:
            settings.estimatedMinutes,
        },
      })
    },
    "public-store",
  )
}
