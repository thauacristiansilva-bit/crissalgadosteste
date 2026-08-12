import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  moveTenantIngredientStock,
  type IngredientMovementInput,
} from "@/lib/food-composition-db"
import { canManageCatalog, getVerifiedTenantSession } from "@/lib/tenant-access"
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const kinds = new Set<IngredientMovementInput["kind"]>([
  "manual_in",
  "manual_out",
  "adjustment",
  "waste",
])

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }
  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Sessão multiempresa inválida." }, { status: 409 })
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Seu perfil não pode movimentar o estoque." }, { status: 403 })
  }

  const { id } = await context.params
  const ingredientId = Number(id)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const kind = String(body?.kind || "") as IngredientMovementInput["kind"]
  if (!Number.isInteger(ingredientId) || ingredientId <= 0 || !body || !kinds.has(kind)) {
    return NextResponse.json({ error: "Movimentação inválida." }, { status: 400 })
  }

  try {
    await assertOrganizationEntitlement(session.organizationId, "inventory")

    const ingredient = await moveTenantIngredientStock(session.organizationId, ingredientId, {
      kind,
      quantity: Number(body.quantity),
      note: String(body.note || ""),
    })
    if (!ingredient) {
      return NextResponse.json({ error: "Ingrediente não encontrado." }, { status: 404 })
    }
    return NextResponse.json({ ingredient })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível movimentar o estoque." },
      { status: billingErrorStatus(error) },
    )
  }
}
