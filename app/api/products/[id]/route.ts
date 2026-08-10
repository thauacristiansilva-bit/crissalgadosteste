import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { deleteProduct, updateProduct } from "@/lib/db"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await context.params
  const numericId = Number(id)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!Number.isInteger(numericId) || !body) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  if (body.price !== undefined && (!Number.isFinite(Number(body.price)) || Number(body.price) <= 0)) {
    return NextResponse.json({ error: "Preço inválido." }, { status: 400 })
  }
  const product = await updateProduct(numericId, {
    ...(body.name !== undefined ? { name: String(body.name) } : {}),
    ...(body.description !== undefined ? { description: String(body.description) } : {}),
    ...(body.category !== undefined ? { category: String(body.category) } : {}),
    ...(body.price !== undefined ? { price: Number(body.price) } : {}),
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    ...(body.image !== undefined ? { image: String(body.image) } : {}),
    ...(body.featured !== undefined ? { featured: Boolean(body.featured) } : {}),
    ...(body.trackStock !== undefined ? { trackStock: Boolean(body.trackStock) } : {}),
    ...(body.stock !== undefined ? { stock: Number(body.stock) } : {}),
  })
  if (!product) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 })
  return NextResponse.json({ product })
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await context.params
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) return NextResponse.json({ error: "Produto inválido." }, { status: 400 })
  const deleted = await deleteProduct(numericId)
  if (!deleted) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 })
  return NextResponse.json({ ok: true })
}
