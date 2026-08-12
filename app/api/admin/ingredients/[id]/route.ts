import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { updateTenantIngredient } from "@/lib/food-composition-db"
import { canManageCatalog, getVerifiedTenantSession } from "@/lib/tenant-access"
import type { IngredientUnit } from "@/lib/types"
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
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
    return NextResponse.json({ error: "Seu perfil não pode alterar o estoque." }, { status: 403 })
  }

  const { id } = await context.params
  const ingredientId = Number(id)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!Number.isInteger(ingredientId) || ingredientId <= 0 || !body) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  }

  try {
    await assertOrganizationEntitlement(session.organizationId, "inventory")

    const ingredient = await updateTenantIngredient(session.organizationId, ingredientId, {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.unit !== undefined ? { unit: String(body.unit) as IngredientUnit } : {}),
      ...(body.minStockQuantity !== undefined
        ? { minStockQuantity: Number(body.minStockQuantity) }
        : {}),
      ...(body.unitCost !== undefined ? { unitCost: Number(body.unitCost) } : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    })
    if (!ingredient) {
      return NextResponse.json({ error: "Ingrediente não encontrado." }, { status: 404 })
    }
    return NextResponse.json({ ingredient })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível alterar o ingrediente." },
      { status: billingErrorStatus(error) },
    )
  }
}
