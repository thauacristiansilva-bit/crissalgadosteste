import { NextRequest, NextResponse } from "next/server"
import { getDeliveryZones, getSettings } from "@/lib/db"
import { calculateDeliveryQuote } from "@/lib/delivery-pricing"

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"))
  const longitude = Number(request.nextUrl.searchParams.get("lng"))
  const subtotal = Number(request.nextUrl.searchParams.get("subtotal") || 0)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return NextResponse.json({ error: "Latitude e longitude são obrigatórias." }, { status: 400 })
  try {
    const [settings, zones] = await Promise.all([getSettings(), getDeliveryZones()])
    const quote = await calculateDeliveryQuote(settings, zones, latitude, longitude, Number.isFinite(subtotal) ? subtotal : 0)
    return NextResponse.json({ quote })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível calcular a entrega." }, { status: 400 })
  }
}
