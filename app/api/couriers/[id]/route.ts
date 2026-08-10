import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { deleteCourier, updateCourier } from "@/lib/db"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await context.params
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  const courier = await updateCourier(Number(id), {
    ...(body.name !== undefined ? { name: String(body.name) } : {}),
    ...(body.phone !== undefined ? { phone: String(body.phone) } : {}),
    ...(body.vehicle !== undefined ? { vehicle: String(body.vehicle) } : {}),
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
  })
  if (!courier) return NextResponse.json({ error: "Entregador não encontrado." }, { status: 404 })
  return NextResponse.json({ courier })
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await context.params
  const deleted = await deleteCourier(Number(id))
  if (!deleted) return NextResponse.json({ error: "Entregador não encontrado." }, { status: 404 })
  return NextResponse.json({ ok: true })
}
