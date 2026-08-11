import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getCurrentCustomerAccount } from "@/lib/client-auth"
import { createOrder, getOrders as getLegacyOrders } from "@/lib/db"
import {
  getTenantOrders,
  isTenantOrdersReady,
} from "@/lib/order-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import type { Order } from "@/lib/types"

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
    (await isTenantOrdersReady(session.organizationId).catch(() => false))
  ) {
    return NextResponse.json({
      orders: await getTenantOrders(session.organizationId),
    })
  }

  return NextResponse.json({
    orders: await getLegacyOrders(),
  })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        type?: Order["type"]
        paymentMethod?: Order["paymentMethod"]
        changeFor?: string
        notes?: string
        customer?: Order["customer"]
        items?: Array<{ productId: number; quantity: number }>
        requestedFor?: string
        timing?: "now" | "scheduled"
        couponCode?: string
      }
    | null

  if (
    !body ||
    !body.customer ||
    !Array.isArray(body.items) ||
    !body.items.length
  ) {
    return NextResponse.json(
      { error: "Pedido incompleto." },
      { status: 400 },
    )
  }

  const timing = body.timing === "now" ? "now" : "scheduled"

  if (timing === "scheduled" && !body.requestedFor) {
    return NextResponse.json(
      { error: "Escolha o dia e o horário do agendamento." },
      { status: 400 },
    )
  }

  if (!body.customer.name?.trim() || !body.customer.phone?.trim()) {
    return NextResponse.json(
      { error: "Nome e telefone são obrigatórios." },
      { status: 400 },
    )
  }

  const type = body.type === "delivery" ? "delivery" : "pickup"

  if (
    type === "delivery" &&
    (!body.customer.address?.trim() || !body.customer.number?.trim())
  ) {
    return NextResponse.json(
      { error: "Endereço e número são obrigatórios para delivery." },
      { status: 400 },
    )
  }

  const paymentMethod = ["card", "cash", "pix"].includes(
    String(body.paymentMethod),
  )
    ? (body.paymentMethod as Order["paymentMethod"])
    : "pix"

  const account = await getCurrentCustomerAccount()

  try {
    const order = await createOrder({
      type,
      paymentMethod,
      changeFor: body.changeFor,
      notes: body.notes,
      customer: {
        ...body.customer,
        ...(account ? { accountId: account.id } : {}),
      },
      items: body.items,
      requestedFor: body.requestedFor,
      timing,
      couponCode: body.couponCode,
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o pedido.",
      },
      { status: 400 },
    )
  }
}
