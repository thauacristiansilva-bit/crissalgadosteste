import { NextResponse } from "next/server"
import {
  createProduct as createLegacyProduct,
  getProducts as getLegacyProducts,
  syncLegacyCategoryFromTenant,
  syncLegacyProductFromTenant,
} from "@/lib/db"
import {
  createTenantProduct,
  getTenantProducts,
  isCurrentDeploymentOrganization,
  isTenantCatalogReady,
} from "@/lib/catalog-db"
import {
  canManageCatalog,
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import { isAdminAuthenticated } from "@/lib/auth"

export async function GET() {
  const session = await getVerifiedTenantSession().catch(() => null)

  if (
    session &&
    (await isTenantCatalogReady(session.organizationId).catch(() => false))
  ) {
    return NextResponse.json({
      products: await getTenantProducts(session.organizationId),
    })
  }

  return NextResponse.json({
    products: await getLegacyProducts(),
  })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
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
    const session = await getVerifiedTenantSession()
    const catalogReady =
      session &&
      (await isTenantCatalogReady(session.organizationId))

    if (!session || !catalogReady) {
      const product = await createLegacyProduct(input)
      return NextResponse.json({ product }, { status: 201 })
    }

    if (!canManageCatalog(session.role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode alterar o catálogo." },
        { status: 403 },
      )
    }

    const result = await createTenantProduct(
      session.organizationId,
      input,
    )

    if (await isCurrentDeploymentOrganization(session.organizationId)) {
      if (result.createdCategory) {
        await syncLegacyCategoryFromTenant(result.createdCategory)
      }
      await syncLegacyProductFromTenant(result.product)
    }

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
      { status: 400 },
    )
  }
}
