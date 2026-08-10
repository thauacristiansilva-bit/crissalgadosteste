import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { createStaffMember, getStaffMembers } from "@/lib/db"
import type { StaffRole } from "@/lib/types"

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  return NextResponse.json({ staffMembers: await getStaffMembers() })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  try {
    const staffMember = await createStaffMember({ name: String(body.name || ""), email: String(body.email || ""), phone: String(body.phone || ""), role: String(body.role || "cashier") as StaffRole, permissions: Array.isArray(body.permissions) ? body.permissions.map(String) : [] })
    return NextResponse.json({ staffMember }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível cadastrar." }, { status: 400 })
  }
}
