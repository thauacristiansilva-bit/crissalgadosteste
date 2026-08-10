import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { createProduct, getProducts } from "@/lib/db"

export async function GET() {
  const products = await getProducts()
  return NextResponse.json({ products })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || !String(body.name || "").trim() || !String(body.category || "").trim()) {
    return NextResponse.json({ error: "Nome e categoria são obrigatórios." }, { status: 400 })
  }
  const price = Number(body.price)
  if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: "Preço inválido." }, { status: 400 })
  const product = await createProduct({
    name: String(body.name),
    description: String(body.description || ""),
    category: String(body.category),
    price,
    image: String(body.image || ""),
    featured: Boolean(body.featured),
    trackStock: Boolean(body.trackStock),
    stock: Number(body.stock || 0),
    minStock: Number(body.minStock || 0),
  })
  return NextResponse.json({ product }, { status: 201 })
}
