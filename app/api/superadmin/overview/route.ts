import { NextResponse } from "next/server"
import { getSuperadminAccess } from "@/lib/superadmin-auth"
import { getSuperadminSnapshot } from "@/lib/superadmin-db"

export const dynamic = "force-dynamic"

export async function GET() {
  const access = await getSuperadminAccess()
  if (!access) return NextResponse.json({ error: "Não autorizado." }, { status: 403 })
  return NextResponse.json({ ok: true, access: { email: access.email, role: access.role }, data: await getSuperadminSnapshot() })
}
