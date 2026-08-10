import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { deleteDeliveryZone, updateDeliveryZone } from "@/lib/db"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await context.params
  const numericId = Number(id)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!Number.isInteger(numericId) || !body) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  const deliveryZone = await updateDeliveryZone(numericId, {
    ...(body.name !== undefined ? { name: String(body.name) } : {}),
    ...(body.centerLat !== undefined ? { centerLat: Number(body.centerLat) } : {}),
    ...(body.centerLng !== undefined ? { centerLng: Number(body.centerLng) } : {}),
    ...(body.radiusMeters !== undefined ? { radiusMeters: Number(body.radiusMeters) } : {}),
    ...(body.fee !== undefined ? { fee: Number(body.fee) } : {}),
    ...(body.shape !== undefined ? { shape: body.shape === "polygon" ? "polygon" as const : "circle" as const } : {}),
    ...(Array.isArray(body.points) ? { points: body.points as Array<{ lat: number; lng: number }> } : {}),
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
  })
  if (!deliveryZone) return NextResponse.json({ error: "Área não encontrada." }, { status: 404 })
  return NextResponse.json({ deliveryZone })
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await context.params
  const deleted = await deleteDeliveryZone(Number(id))
  if (!deleted) return NextResponse.json({ error: "Área não encontrada." }, { status: 404 })
  return NextResponse.json({ ok: true })
}
