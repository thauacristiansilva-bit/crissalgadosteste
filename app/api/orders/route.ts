import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { createOrder, getOrders } from "@/lib/db"
import type { Order } from "@/lib/types"

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  return NextResponse.json({ orders: await getOrders() })
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
      }
    | null

  if (!body || !body.customer || !Array.isArray(body.items) || !body.items.length || !body.requestedFor) {
    return NextResponse.json({ error: "Pedido incompleto. Escolha também o dia e horário de recebimento." }, { status: 400 })
  }
  if (!body.customer.name?.trim() || !body.customer.phone?.trim()) {
    return NextResponse.json({ error: "Nome e telefone são obrigatórios." }, { status: 400 })
  }
  const type = body.type === "delivery" ? "delivery" : "pickup"
  if (type === "delivery" && (!body.customer.address?.trim() || !body.customer.number?.trim())) {
    return NextResponse.json({ error: "Endereço e número são obrigatórios para delivery." }, { status: 400 })
  }
  const paymentMethod = ["card", "cash", "pix"].includes(String(body.paymentMethod))
    ? (body.paymentMethod as Order["paymentMethod"])
    : "pix"

  try {
    const order = await createOrder({
      type,
      paymentMethod,
      changeFor: body.changeFor,
      notes: body.notes,
      customer: body.customer,
      items: body.items,
      requestedFor: body.requestedFor,
    })
    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar o pedido." }, { status: 400 })
  }
}
