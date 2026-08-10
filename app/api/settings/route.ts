import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getSettings, updateSettings } from "@/lib/db"
import type { StoreSettings } from "@/lib/types"

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  return NextResponse.json({ settings: await getSettings() })
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as Partial<StoreSettings> | null
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  const settings = await updateSettings(body)
  return NextResponse.json({ settings })
}
