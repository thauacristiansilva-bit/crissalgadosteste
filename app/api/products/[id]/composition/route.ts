import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  getProductComposition,
  isTenantFoodCompositionReady,
  replaceProductComposition,
  type ProductCompositionInput,
} from "@/lib/food-composition-db"
import {
  canManageCatalog,
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { error: "A composição de produtos exige a sessão multiempresa PostgreSQL." },
      { status: 409 },
    )
  }

  const { id } = await context.params
  const productId = Number(id)
  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: "Produto inválido." }, { status: 400 })
  }

  if (!(await isTenantFoodCompositionReady(session.organizationId))) {
    return NextResponse.json(
      { error: "A estrutura de complementos e ingredientes ainda não foi preparada para esta empresa." },
      { status: 503 },
    )
  }

  const composition = await getProductComposition(session.organizationId, productId)
  if (!composition) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 })
  }

  return NextResponse.json({ composition })
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { error: "A composição de produtos exige a sessão multiempresa PostgreSQL." },
      { status: 409 },
    )
  }

  if (!canManageCatalog(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode alterar o catálogo." },
      { status: 403 },
    )
  }

  const { id } = await context.params
  const productId = Number(id)
  const body = (await request.json().catch(() => null)) as ProductCompositionInput | null
  if (!Number.isInteger(productId) || productId <= 0 || !body) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  }

  if (!(await isTenantFoodCompositionReady(session.organizationId))) {
    return NextResponse.json(
      { error: "Execute a migration da Fase 11/12 antes de salvar complementos." },
      { status: 503 },
    )
  }

  try {
    if (Array.isArray(body.modifierGroups) && body.modifierGroups.length > 0) {
      await assertOrganizationEntitlement(session.organizationId, "modifiers")
    }
    const usesInventory =
      (Array.isArray(body.recipe) && body.recipe.length > 0) ||
      (Array.isArray(body.modifierGroups) && body.modifierGroups.some((group) =>
        Array.isArray(group.options) && group.options.some((option) => Array.isArray(option.ingredients) && option.ingredients.length > 0)
      ))
    if (usesInventory) {
      await assertOrganizationEntitlement(session.organizationId, "inventory")
    }

    const composition = await replaceProductComposition(
      session.organizationId,
      productId,
      body,
    )
    return NextResponse.json({ composition })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a composição do produto.",
      },
      { status: billingErrorStatus(error) },
    )
  }
}
