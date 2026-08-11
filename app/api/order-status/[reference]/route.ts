import { NextResponse } from "next/server"
import {
  getOrderByReference as getLegacyOrderByReference,
  getSettings,
} from "@/lib/db"
import { getCurrentDeploymentOrderByReference } from "@/lib/order-db"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ reference: string }> },
) {
  const { reference } = await context.params

  const [postgresOrder, settings] = await Promise.all([
    getCurrentDeploymentOrderByReference(reference).catch(() => null),
    getSettings(),
  ])

  const order =
    postgresOrder ||
    (await getLegacyOrderByReference(reference))

  if (!order) {
    return NextResponse.json(
      { error: "Pedido não encontrado." },
      { status: 404 },
    )
  }

  return NextResponse.json({
    order,
    store: {
      storeName: settings.storeName,
      whatsapp: settings.whatsapp,
      estimatedMinutes: settings.estimatedMinutes,
    },
  })
}
