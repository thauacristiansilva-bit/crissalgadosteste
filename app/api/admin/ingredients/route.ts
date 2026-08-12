import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createTenantIngredient,
  getTenantIngredients,
  isTenantFoodCompositionReady,
} from "@/lib/food-composition-db"
import { canManageCatalog, getVerifiedTenantSession } from "@/lib/tenant-access"
import type { IngredientUnit } from "@/lib/types"
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { error: "O estoque de ingredientes exige a sessão multiempresa PostgreSQL." },
      { status: 409 },
    )
  }

  try {
    await assertOrganizationEntitlement(session.organizationId, "inventory")
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Recurso não disponível no plano." }, { status: billingErrorStatus(error) })
  }

  if (!(await isTenantFoodCompositionReady(session.organizationId))) {
    return NextResponse.json(
      { error: "Execute a migration da Fase 11/12 antes de usar ingredientes." },
      { status: 503 },
    )
  }

  return NextResponse.json({
    ingredients: await getTenantIngredients(session.organizationId, {
      includeInactive: true,
    }),
  })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { error: "O estoque de ingredientes exige a sessão multiempresa PostgreSQL." },
      { status: 409 },
    )
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode alterar o estoque." },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  }

  if (!(await isTenantFoodCompositionReady(session.organizationId))) {
    return NextResponse.json(
      { error: "Execute a migration da Fase 11/12 antes de usar ingredientes." },
      { status: 503 },
    )
  }

  try {
    await assertOrganizationEntitlement(session.organizationId, "inventory")

    const ingredient = await createTenantIngredient(session.organizationId, {
      name: String(body.name || ""),
      unit: String(body.unit || "g") as IngredientUnit,
      stockQuantity: Number(body.stockQuantity || 0),
      minStockQuantity: Number(body.minStockQuantity || 0),
      unitCost: Number(body.unitCost || 0),
    })
    return NextResponse.json({ ingredient }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível cadastrar o ingrediente." },
      { status: billingErrorStatus(error) },
    )
  }
}
