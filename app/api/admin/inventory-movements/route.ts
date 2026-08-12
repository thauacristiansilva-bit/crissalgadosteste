import { NextResponse } from "next/server"
import { getTenantInventoryMovements } from "@/lib/food-composition-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Sessão multiempresa inválida." }, { status: 401 })
  }
  try {
    await assertOrganizationEntitlement(session.organizationId, "inventory")
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get("limit") || 50)
    return NextResponse.json({
      movements: await getTenantInventoryMovements(session.organizationId, limit),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Inventário indisponível no plano." },
      { status: billingErrorStatus(error) },
    )
  }
}
