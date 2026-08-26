import { NextResponse } from "next/server"
import {
  createTenantProduct,
  getTenantProducts,
} from "@/lib/catalog-db"
import {
  canManageCatalog,
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import { assertCanCreateProduct, billingErrorStatus } from "@/lib/billing-db"

export async function GET() {
  const session = await getVerifiedTenantSession().catch(() => null)

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  return NextResponse.json({
    products: await getTenantProducts(session.organizationId),
  })
}

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession().catch(() => null)

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (
    !body ||
    !String(body.name || "").trim() ||
    !String(body.category || "").trim()
  ) {
    return NextResponse.json(
      { error: "Nome e categoria são obrigatórios." },
      { status: 400 },
    )
  }

  const price = Number(body.price)
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json(
      { error: "Preço inválido." },
      { status: 400 },
    )
  }

  const input = {
    name: String(body.name),
    description: String(body.description || ""),
    category: String(body.category),
    price,
    image: String(body.image || ""),
    featured: Boolean(body.featured),
    trackStock: Boolean(body.trackStock),
    stock: Number(body.stock || 0),
    minStock: Number(body.minStock || 0),
  }

  try {
    if (!canManageCatalog(session.role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode alterar o catálogo." },
        { status: 403 },
      )
    }

    await assertCanCreateProduct(session.organizationId)

    const result = await createTenantProduct(
      session.organizationId,
      input,
    )

    return NextResponse.json(
      { product: result.product },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o produto.",
      },
      { status: billingErrorStatus(error) },
    )
  }
}
