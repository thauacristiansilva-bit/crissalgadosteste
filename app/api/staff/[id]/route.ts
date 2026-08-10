import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { updateStaffMember } from "@/lib/db"
import type { StaffRole } from "@/lib/types"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await context.params
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  const staffMember = await updateStaffMember(Number(id), {
    ...(body.name !== undefined ? { name: String(body.name) } : {}),
    ...(body.email !== undefined ? { email: String(body.email) } : {}),
    ...(body.phone !== undefined ? { phone: String(body.phone) } : {}),
    ...(body.role !== undefined ? { role: String(body.role) as StaffRole } : {}),
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    ...(body.permissions !== undefined && Array.isArray(body.permissions) ? { permissions: body.permissions.map(String) } : {}),
  })
  if (!staffMember) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 })
  return NextResponse.json({ staffMember })
}
