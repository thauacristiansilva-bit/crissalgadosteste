import { NextResponse } from "next/server"
import { getOrderByReference, getSettings } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params
  const [order, settings] = await Promise.all([getOrderByReference(reference), getSettings()])
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  return NextResponse.json({ order, store: { storeName: settings.storeName, whatsapp: settings.whatsapp, estimatedMinutes: settings.estimatedMinutes } })
}
