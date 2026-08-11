import { NextResponse } from "next/server"
import {
  getOrderByReference as getLegacyOrderByReference,
  getSettings as getLegacySettings,
} from "@/lib/db"
import {
  getTenantOrderByReference,
  isTenantOrdersReady,
} from "@/lib/order-db"
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

  const ordersReady =
    await isTenantOrdersReady(
      organization.id,
    ).catch(() => false)

  const isCurrent =
    await isCurrentDeploymentOrganization(
      organization.id,
    )

  const order = ordersReady
    ? await getTenantOrderByReference(
        organization.id,
        reference,
      )
    : isCurrent
      ? await getLegacyOrderByReference(
          reference,
        )
      : null

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

  const settings =
    runtimeReady
      ? await getTenantSettings(organization.id)
      : isCurrent
        ? await getLegacySettings()
        : null

  if (!settings) {
    return NextResponse.json(
      { error: "Loja indisponível." },
      { status: 503 },
    )
  }

  return NextResponse.json({
    order,
    store: {
      storeName: settings.storeName,
      whatsapp: settings.whatsapp,
      estimatedMinutes:
        settings.estimatedMinutes,
    },
  })
}
