import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { createCourier, getCouriers } from "@/lib/db"

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  return NextResponse.json({ couriers: await getCouriers({ includeInactive: true }) })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  try {
    const courier = await createCourier({ name: String(body.name || ""), phone: String(body.phone || ""), vehicle: String(body.vehicle || "") })
    return NextResponse.json({ courier }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível cadastrar o entregador." }, { status: 400 })
  }
}
