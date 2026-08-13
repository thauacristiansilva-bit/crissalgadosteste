import { NextResponse } from "next/server"
import { canAccessFoodOperations, getFoodOperationsOverview } from "@/lib/food-operations-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessFoodOperations(session)) {
    return NextResponse.json({ error: "Seu perfil não possui acesso à operação alimentar avançada." }, { status: 403 })
  }

  try {
    return NextResponse.json(await getFoodOperationsOverview(session))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar a operação alimentar." },
      { status: 503 },
    )
  }
}
