import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { createDeliveryZone, getDeliveryZones } from "@/lib/db"

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  return NextResponse.json({ deliveryZones: await getDeliveryZones({ includeInactive: true }) })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  try {
    const deliveryZone = await createDeliveryZone({
      name: String(body.name || ""),
      centerLat: Number(body.centerLat),
      centerLng: Number(body.centerLng),
      radiusMeters: Number(body.radiusMeters),
      fee: Number(body.fee),
    })
    return NextResponse.json({ deliveryZone }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível cadastrar a área." }, { status: 400 })
  }
}
