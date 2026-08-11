import { NextResponse } from "next/server"
import {
  getSettings,
  getUnprintedOrders as getLegacyUnprintedOrders,
  markOrderPrinted as markLegacyOrderPrinted,
  syncLegacyOrderFromTenant,
} from "@/lib/db"
import {
  getCurrentDeploymentUnprintedOrders,
  markCurrentDeploymentOrderPrinted,
} from "@/lib/order-db"

function authorized(request: Request) {
  const configured = process.env.PRINT_AGENT_TOKEN
  if (!configured) return false

  const token =
    request.headers.get("x-print-token") ||
    new URL(request.url).searchParams.get("token")

  return token === configured
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const postgresOrders =
    await getCurrentDeploymentUnprintedOrders().catch(() => null)

  const [orders, settings] = await Promise.all([
    postgresOrders ?? getLegacyUnprintedOrders(),
    getSettings(),
  ])

  return NextResponse.json({
    orders,
    settings: {
      storeName: settings.storeName,
      address: settings.address,
      printerName: settings.printerName,
      printCopies: settings.printCopies,
      autoPrintNewOrders: settings.autoPrintNewOrders,
      printKitchenTicket: settings.printKitchenTicket,
      printCustomerTicket: settings.printCustomerTicket,
    },
  })
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { orderId?: number }
    | null

  if (!body?.orderId) {
    return NextResponse.json(
      { error: "Pedido inválido." },
      { status: 400 },
    )
  }

  const id = Number(body.orderId)

  const postgresOrder =
    await markCurrentDeploymentOrderPrinted(id).catch(() => null)

  if (postgresOrder) {
    await syncLegacyOrderFromTenant(postgresOrder)
    return NextResponse.json({ order: postgresOrder })
  }

  return NextResponse.json({
    order: await markLegacyOrderPrinted(id),
  })
}
