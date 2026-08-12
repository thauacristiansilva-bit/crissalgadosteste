import { NextResponse } from "next/server"
import { getTenantInventoryMovements } from "@/lib/food-composition-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Sessão multiempresa inválida." }, { status: 401 })
  }
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") || 50)
  return NextResponse.json({
    movements: await getTenantInventoryMovements(session.organizationId, limit),
  })
}
