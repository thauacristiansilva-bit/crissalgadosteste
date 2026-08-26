import { NextResponse } from "next/server"
import {
  deactivateTenantProduct,
  updateTenantProduct,
} from "@/lib/catalog-db"
import {
  canManageCatalog,
  getVerifiedTenantSession,
} from "@/lib/tenant-access"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getVerifiedTenantSession().catch(() => null)

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const { id } = await context.params
  const numericId = Number(id)
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!Number.isInteger(numericId) || !body) {
    return NextResponse.json(
      { error: "Requisição inválida." },
      { status: 400 },
    )
  }

  if (
    body.price !== undefined &&
    (!Number.isFinite(Number(body.price)) || Number(body.price) <= 0)
  ) {
    return NextResponse.json(
      { error: "Preço inválido." },
      { status: 400 },
    )
  }

  const patch = {
    ...(body.name !== undefined
      ? { name: String(body.name) }
      : {}),
    ...(body.description !== undefined
      ? { description: String(body.description) }
      : {}),
    ...(body.category !== undefined
      ? { category: String(body.category) }
      : {}),
    ...(body.price !== undefined
      ? { price: Number(body.price) }
      : {}),
    ...(body.active !== undefined
      ? { active: Boolean(body.active) }
      : {}),
    ...(body.image !== undefined
      ? { image: String(body.image) }
      : {}),
    ...(body.featured !== undefined
      ? { featured: Boolean(body.featured) }
      : {}),
    ...(body.trackStock !== undefined
      ? { trackStock: Boolean(body.trackStock) }
      : {}),
    ...(body.stock !== undefined
      ? { stock: Number(body.stock) }
      : {}),
    ...(body.minStock !== undefined
      ? { minStock: Number(body.minStock) }
      : {}),
  }

  try {
    if (!canManageCatalog(session.role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode alterar o catálogo." },
        { status: 403 },
      )
    }

    const result = await updateTenantProduct(
      session.organizationId,
      numericId,
      patch,
    )

    if (!result) {
      return NextResponse.json(
        { error: "Produto não encontrado." },
        { status: 404 },
      )
    }

    return NextResponse.json({ product: result.product })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o produto.",
      },
      { status: 400 },
    )
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getVerifiedTenantSession().catch(() => null)

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const { id } = await context.params
  const numericId = Number(id)

  if (!Number.isInteger(numericId)) {
    return NextResponse.json(
      { error: "Produto inválido." },
      { status: 400 },
    )
  }

  if (!canManageCatalog(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode alterar o catálogo." },
      { status: 403 },
    )
  }

  const product = await deactivateTenantProduct(
    session.organizationId,
    numericId,
  )

  if (!product) {
    return NextResponse.json(
      { error: "Produto não encontrado." },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true })
}
